"use client";

import type { NextPage } from 'next';
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface Source {
  pageContent: string;
  metadata: {
    source: string;
    [key: string]: unknown;
  };
}

interface Message {
  text: string;
  sender: 'user' | 'bot';
  sources?: Source[];
}

// Response shapes from backend
interface QueryResponseV1 { response: string; sources?: Source[] }
interface QueryResponseV2 { answer: string }
interface QueryResponseV3 { answer: { response?: string; answer?: string; sources?: Source[]; context?: Source[] } }

type QueryResponse = QueryResponseV1 | QueryResponseV2 | QueryResponseV3;

const API_URL = 'http://localhost:3000/api';

const Home: NextPage = () => {
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { text: "Welcome! Ask me anything about your documents or websites.", sender: 'bot' }
  ]);
  const [chatMessage, setChatMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ingestion progress and sources
  const [progressLines, setProgressLines] = useState<string[]>([]);
  const [allDocuments, setAllDocuments] = useState<Array<{ source: string; title: string; chunks: number; lastUpdated: string }>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // State for timestamp removal
  const [removeTimestamps, setRemoveTimestamps] = useState(false);

  useEffect(() => {
    return () => {
      // cleanup SSE on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Load all documents on component mount
  useEffect(() => {
    fetchAllDocuments();
  }, []);

  const fetchAllDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await axios.get(`${API_URL}/documents`);
      if (response.data.success && Array.isArray(response.data.documents)) {
        setAllDocuments(response.data.documents);
      } else {
        console.error('Invalid response format:', response.data);
        setAllDocuments([]);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load documents. Please try refreshing.');
      setAllDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const deleteDocument = async (source: string) => {
    try {
      await axios.delete(`${API_URL}/documents/${encodeURIComponent(source)}`);
      // Refresh the documents list after deletion
      await fetchAllDocuments();
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to delete document:', err);
      let errorMessage = 'Failed to delete document. Please try again.';

      if (axios.isAxiosError(err) && err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    }
  };

  const handleError = (err: unknown, defaultMessage: string) => {
    let message = defaultMessage;
    if (axios.isAxiosError(err) && err.response?.data?.message) {
      message = err.response.data.message as string;
    } else if (err instanceof Error) {
      message = err.message;
    }
    setError(message);
    console.error(err);
  };

  const explainProgress = (message: string) => {
    // Lightweight narrator for progress messages
    if (!message) return '';
    if (message.startsWith('Starting recursive crawl')) return 'Starting recursive website crawl…';
    if (message.startsWith('Checking robots.txt')) return 'Checking robots.txt…';
    if (message.startsWith('Crawling page')) return message; // Keep detailed page info
    if (message.startsWith('Processing page')) return message; // Keep detailed processing info
    if (message.startsWith('Processing') && message.includes('pages for embeddings')) return message;
    if (message.startsWith('Chunking all pages')) return 'Splitting all pages into chunks…';
    if (message.startsWith('Storing') && message.includes('chunks from')) return message;
    if (message.startsWith('Crawl complete')) return message;
    if (message.startsWith('Fetching page')) return 'Fetching page…';
    if (message.startsWith('Extracting content')) return 'Extracting content…';
    if (message.startsWith('Chunking')) return 'Splitting into chunks…';
    if (message.startsWith('Storing')) return 'Storing chunks…';
    if (message.startsWith('Uploading file')) return 'Uploading file…';
    if (message.startsWith('Reading file')) return 'Reading file…';
    if (message.startsWith('Extracting text from PDF')) return 'Reading PDF text…';
    if (message.startsWith('Extracting text from DOCX')) return 'Reading DOCX text…';
    if (message.startsWith('Reading text file')) return 'Reading text…';
    if (message.startsWith('Starting crawl')) return 'Starting crawl…';
    if (message.startsWith('Text processed')) return 'Text processed.';
    if (message.toLowerCase().startsWith('error')) return `Error: ${message.replace(/^Error:\s*/, '')}`;
    if (message.toLowerCase().includes('skipped')) return message; // Keep skip messages
    if (message.toLowerCase().includes('warning')) return message; // Keep warning messages
    return message;
  };

  const createOpId = () => `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const startProgressStream = (opId: string) => {
    // Reset state and open SSE
    setProgressLines([]);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const url = `${API_URL}/progress/${opId}`.replace('/api/api/', '/api/'); // guard against double /api
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('open', () => {
      setProgressLines((prev: string[]) => [...prev, 'Connected.']);
    });

    es.addEventListener('progress', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data || '{}');
        const friendly = explainProgress(data.message as string);
        if (friendly) setProgressLines((prev: string[]) => [...prev, friendly]);
      } catch {
        setProgressLines((prev: string[]) => [...prev, 'Working…']);
      }
    });

    es.addEventListener('done', (ev) => {
      try {
        setProgressLines((prev: string[]) => [...prev, 'Done.']);
        // Refresh the full documents list after new ingestion
        fetchAllDocuments();
      } catch {
        setProgressLines((prev: string[]) => [...prev, 'Done.']);
      } finally {
        es.close();
        eventSourceRef.current = null;
      }
    });

    es.onerror = () => {
      setProgressLines((prev: string[]) => [...prev, 'Connection lost.']);
    };
  };

  const handleAddText = async () => {
    if (!textInput.trim()) return;
    setIsLoadingText(true);
    setError(null);
    const opId = createOpId();
    startProgressStream(opId);
    try {
      await axios.post(`${API_URL}/text`, { text: textInput }, { params: { opId } });
      setTextInput('');
    } catch (err) {
      handleError(err, 'Failed to add text.');
    } finally {
      setIsLoadingText(false);
    }
  };

  const handleCrawlUrl = async () => {
    if (!urlInput.trim()) return;
    setIsLoadingUrl(true);
    setError(null);
    const opId = createOpId();
    startProgressStream(opId);
    try {
      await axios.post(`${API_URL}/crawl`, { url: urlInput }, { params: { opId } });
      setUrlInput('');
    } catch (err) {
      handleError(err, 'Failed to crawl website.');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    const files = Array.from(event.target.files);
    setIsLoadingFile(true);
    setError(null);
    const opId = createOpId();
    startProgressStream(opId);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('document', file));
      await axios.post(`${API_URL}/documents`, formData, {
        params: { opId, removeTimestamps }, // Pass removeTimestamps
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      handleError(err, 'Failed to upload file.');
    } finally {
      setIsLoadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    const newUserMessage: Message = { text: chatMessage, sender: 'user' };
    setChatHistory(prev => [...prev, newUserMessage]);
    setChatMessage('');
    setIsLoadingChat(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/query`, { question: chatMessage });
      const data: QueryResponse = response.data as QueryResponse;
      let answerText = '';
      let sources: Source[] | undefined;

      if ('answer' in data && typeof data.answer === 'string') {
        answerText = data.answer;
      } else if ('response' in data && typeof data.response === 'string') {
        answerText = data.response;
        sources = data.sources;
      } else if ('answer' in data && typeof data.answer === 'object' && data.answer) {
        answerText = data.answer.response ?? data.answer.answer ?? '';
        sources = data.answer.sources ?? data.answer.context;
      }

      const botMessage: Message = { text: answerText || 'No answer returned.', sender: 'bot', sources };
      setChatHistory(prev => [...prev, botMessage]);
    } catch (err) {
      handleError(err, 'Failed to get response.');
    } finally {
      setIsLoadingChat(false);
    }
  };

  const completedCount = progressLines.filter(line => line.includes('Done') || line.includes('complete')).length;
  const progressPercentage = progressLines.length > 0 ? (completedCount / progressLines.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/90 backdrop-blur-sm border border-red-400/50 rounded-lg p-4 max-w-md">
          <div className="flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex h-full relative">
        {/* Left Sidebar */}
        <aside className="w-96 p-6 border-r border-white/10 relative flex-shrink-0">
          {/* Glassmorphism Background */}
          <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border-r border-white/10" />

          <div className="relative z-10 space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Personal NotebookLM
                </h1>
              </div>
              <p className="text-sm text-white/60">AI-powered knowledge assistant</p>
            </div>

            {/* Add Text Section */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 text-white mb-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <h3 className="font-semibold">Add Text</h3>
              </div>
              <textarea
                placeholder="Type or paste text here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full min-h-[100px] bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus:border-blue-400 focus:ring-blue-400/20 rounded-md p-3 resize-none mb-3"
                disabled={isLoadingText}
              />
              <button
                onClick={handleAddText}
                disabled={!textInput.trim() || isLoadingText}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-md py-2 px-4 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoadingText ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
                {isLoadingText ? 'Adding...' : 'Add Text'}
              </button>
            </div>

            {/* Crawl Website Section */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 text-white mb-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                </svg>
                <h3 className="font-semibold">Crawl Website</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus:border-green-400 focus:ring-green-400/20 rounded-md p-2"
                  disabled={isLoadingUrl}
                />
                <button
                  onClick={handleCrawlUrl}
                  disabled={!urlInput.trim() || isLoadingUrl}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 rounded-md py-2 px-4 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingUrl ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Progress Section */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 text-white mb-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="font-semibold">Progress</h3>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {progressLines.map((line, index) => (
                  <div key={index} className="text-xs text-white/70 bg-white/5 rounded px-2 py-1">
                    {line}
                  </div>
                ))}
                {progressLines.length === 0 && (
                  <div className="text-xs text-white/40 italic">No recent activity</div>
                )}
              </div>
            </div>

            {/* File Upload Section */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 text-white mb-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 className="font-semibold">Upload Files</h3>
              </div>

              {/* Timestamp Removal Toggle */}
              <div className="mb-3 p-2 bg-white/5 rounded border border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/80 cursor-pointer">
                    Remove timestamps from subtitle files
                  </label>
                  <input
                    type="checkbox"
                    id="removeTimestamps"
                    checked={removeTimestamps}
                    onChange={(e) => setRemoveTimestamps(e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500 focus:ring-2"
                  />
                </div>
                <p className="text-xs text-white/60 mt-1">
                  Keep timestamps for valuable timing information
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.pdf,.doc,.docx,.md,.csv,.vtt,.srt"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingFile}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white border-0 rounded-md py-2 px-4 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoadingFile ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
                {isLoadingFile ? 'Uploading...' : 'Upload Files'}
              </button>

              {/* Supported Formats */}
              <div className="mt-3 text-xs text-white/60">
                <p className="mb-2 font-medium">Supported formats:</p>
                <div className="grid grid-cols-2 gap-1">
                  <span>• PDF (.pdf)</span>
                  <span>• DOCX (.docx)</span>
                  <span>• Text (.txt)</span>
                  <span>• Markdown (.md)</span>
                  <span>• CSV (.csv)</span>
                  <span>• Subtitles (.vtt, .srt)</span>
                </div>
              </div>
            </div>

            {/* Sources Section */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="font-semibold">Sources</h3>
                </div>
                <button
                  onClick={fetchAllDocuments}
                  disabled={isLoadingDocuments}
                  className="text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded px-2 py-1 transition-colors disabled:opacity-50"
                >
                  {isLoadingDocuments ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {allDocuments.length === 0 ? (
                  <div className="text-white/40 text-sm">
                    {isLoadingDocuments ? 'Loading documents...' : 'No documents in database.'}
                  </div>
                ) : (
                  allDocuments.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-white/5 rounded border border-white/10">
                      <div className="flex-1 min-w-0">
                        {doc.source.startsWith('http') ? (
                          <a
                            href={doc.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-300 hover:text-blue-200 transition-colors truncate block"
                          >
                            {doc.title} ({doc.chunks} chunks)
                          </a>
                        ) : (
                          <span className="text-white/80 truncate block">
                            {doc.title} ({doc.chunks} chunks)
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteDocument(doc.source)}
                        className="ml-2 text-red-400 hover:text-red-300 text-xs transition-colors"
                        title="Delete document"
                      >
                        ✗
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col relative min-w-0">
          {/* Header */}
          <header className="p-6 border-b border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Knowledge Chat</h2>
                <p className="text-sm text-white/60">Ask questions about your documents</p>
              </div>
              <div className="bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-3 py-1 text-sm">
                Online
              </div>
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6 max-w-4xl mx-auto">
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'bot' && (
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                  )}

                  <div className={`max-w-2xl ${msg.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0'
                    : 'bg-white/10 border border-white/20 backdrop-blur-sm text-white'
                    } rounded-lg`}>
                    <div className="p-4">
                      <p className="leading-relaxed">{msg.text}</p>

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/20">
                          <p className="text-xs text-white/60 mb-2">Sources:</p>
                          <div className="space-y-1">
                            {msg.sources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.metadata.source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-blue-300 hover:text-blue-200 transition-colors group"
                              >
                                <svg className="w-3 h-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                <span className="truncate">{source.metadata.source}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoadingChat && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="bg-white/10 border border-white/20 backdrop-blur-sm text-white rounded-lg">
                    <div className="p-4 flex items-center gap-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-2 h-2 bg-white/60 rounded-full animate-pulse"
                            style={{ animationDelay: `${i * 0.2}s` }}
                          />
                        ))}
                      </div>
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Ask a question about your documents..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus:border-blue-400 focus:ring-blue-400/20 rounded-lg px-4 py-3"
                  disabled={isLoadingChat}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || isLoadingChat}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-lg px-6 py-3 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoadingChat ? (
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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Home;
