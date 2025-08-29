"use client";

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';

interface Source {
    pageContent: string;
    metadata: {
        source: string;
        [key: string]: unknown;
    };
}

interface SimpleChatProps {
    onSourcesUpdate?: (sources: Source[]) => void;
    excludedSources?: string[];
}

export function SimpleChat({ excludedSources = [] }: SimpleChatProps) {
    const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; sources?: Source[] }>>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');

    // Initialize session and load previous messages
    useEffect(() => {
        initializeChat();
    }, []);

    const initializeChat = async () => {
        try {
            // Generate or retrieve session ID
            let sessionId = localStorage.getItem('chat_session_id');
            if (!sessionId) {
                sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('chat_session_id', sessionId);
            }
            setSessionId(sessionId);

            // Load previous messages from Supabase
            const { data: previousMessages, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('timestamp', { ascending: true });

            if (error) {
                console.error('Error loading messages:', error);
            } else if (previousMessages) {
                setMessages(previousMessages.map(msg => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content
                })));
            }
        } catch (error) {
            console.error('Error initializing chat:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input };
        setMessages(prev => [userMessage, ...prev]);
        setInput('');
        setIsLoading(true);

        try {
            // Save user message to Supabase
            await saveMessageToSupabase(userMessage);

            const response = await axios.post('/api/chat', {
                messages: [...messages, userMessage],
                excludedSources
            });

            const responseData = await response.data;
            console.log('Response received:', responseData);

            const assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant' as const,
                content: responseData.answer,
                sources: responseData.sources || []
            };

            // Save assistant message to Supabase
            await saveMessageToSupabase(assistantMessage);

            setMessages(prev => [assistantMessage, ...prev]);
        } catch (error) {
            console.error('Chat error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    };

    const saveMessageToSupabase = async (message: { id: string; role: 'user' | 'assistant'; content: string; sources?: Source[] }) => {
        try {
            const { error } = await supabase
                .from('chat_messages')
                .insert({
                    id: message.id,
                    role: message.role,
                    content: message.content,
                    session_id: sessionId,
                    timestamp: new Date().toISOString()
                });

            if (error) {
                console.error('Error saving message:', error);
            }
        } catch (error) {
            console.error('Error saving message:', error);
        }
    };

    const clearChatSession = async () => {
        try {
            // Clear messages from Supabase
            const { error } = await supabase
                .from('chat_messages')
                .delete()
                .eq('session_id', sessionId);

            if (error) {
                console.error('Error clearing messages:', error);
            } else {
                // Clear local state
                setMessages([]);
                // Generate new session ID
                const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                setSessionId(newSessionId);
                localStorage.setItem('chat_session_id', newSessionId);
            }
        } catch (error) {
            console.error('Error clearing session:', error);
        }
    };

    // Auto-resize textarea
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    return (
        <div className="flex flex-col h-full">
            {/* Chat Header with Clear Session Button */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">Chat History</h3>
                <button
                    onClick={clearChatSession}
                    className="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-md transition-colors"
                >
                    Clear Session
                </button>
            </div>

            {/* Input Area - Moved to top */}
            <div className="p-4 border-b border-white/20 bg-white/10 backdrop-blur-sm shadow-sm">
                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
                    <div className="flex gap-4">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Ask a question about your documents..."
                            className="flex-1 bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus:border-blue-400 focus:ring-blue-400/20 rounded-lg px-4 py-3 resize-none"
                            rows={1}
                            style={{ minHeight: '48px', maxHeight: '120px' }}
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-lg px-6 py-3 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            )}
                            Send
                        </button>
                    </div>
                </form>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                    >
                        {message.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white text-sm font-bold">H</span>
                            </div>
                        )}

                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user'
                            ? 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 border border-green-500/30'
                            : 'bg-white/10 border border-white/20 backdrop-blur-sm'
                            }`}>
                            <div className="prose prose-invert max-w-none">
                                <div
                                    className="text-base leading-relaxed"
                                    style={{
                                        lineHeight: '1.2',
                                        wordSpacing: '0.01em',
                                        letterSpacing: '0.002em'
                                    }}
                                    dangerouslySetInnerHTML={{
                                        __html: message.content
                                            .replace(/\n\n/g, '<br><br>')
                                            .replace(/\n/g, '<br>')
                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                            .replace(/`(.*?)`/g, '<code class="bg-gray-700 px-1 py-0.5 rounded text-sm">$1</code>')
                                    }}
                                />

                                {/* Display sources if available */}
                                {message.sources && message.sources.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-white/10">
                                        <div className="text-xs text-white/60 mb-2">Sources:</div>
                                        <div className="space-y-1">
                                            {message.sources.slice(0, 3).map((source: Source, index: number) => (
                                                <div key={index} className="text-xs text-white/70 bg-white/5 rounded px-2 py-1">
                                                    {source.metadata?.source || `Source ${index + 1}`}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {message.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white text-sm font-bold">H</span>
                        </div>
                        <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <div
                                            key={i}
                                            className="w-2 h-2 bg-white/60 rounded-full animate-pulse"
                                            style={{ animationDelay: `${i * 0.2}s` }}
                                        />
                                    ))}
                                </div>
                                <span className="text-sm text-white/60">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Scroll to Bottom Button */}
                {messages.length > 3 && (
                    <div className="absolute bottom-4 right-4">
                        <button
                            onClick={() => {
                                const messagesArea = document.querySelector('.overflow-y-auto');
                                if (messagesArea) {
                                    messagesArea.scrollTop = messagesArea.scrollHeight;
                                }
                            }}
                            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full backdrop-blur-sm transition-colors"
                            title="Scroll to bottom"
                        >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>


        </div>
    );
}
