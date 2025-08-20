"use client";

import type { NextPage } from 'next';
import { useState, useRef } from 'react';
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

  const handleAddText = async () => {
    if (!textInput.trim()) return;
    setIsLoadingText(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/text`, { text: textInput });
      setTextInput('');
      alert('Text added successfully!');
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
    try {
      await axios.post(`${API_URL}/crawl`, { url: urlInput });
      setUrlInput('');
      alert('Website crawling started successfully! It may take a few moments to process.');
    } catch (err) {
      handleError(err, 'Failed to crawl website.');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    const file = event.target.files[0];
    setIsLoadingFile(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('document', file);
      await axios.post(`${API_URL}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(`File "${file.name}" uploaded successfully!`);
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

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
      <header className="p-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold">Personal NotebookLM</h1>
      </header>

      {error && (
        <div className="p-2 bg-red-500 text-white text-center" onClick={() => setError(null)}>
          Error: {error} <button className="ml-4 font-bold">X</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Input */}
        <div className="w-1/3 border-r border-gray-700 p-4 flex flex-col space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Add Text</h2>
            <textarea
              className="w-full h-32 bg-gray-800 border border-gray-600 rounded-md p-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type or paste text here..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isLoadingText}
            />
            <button
              className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500"
              onClick={handleAddText}
              disabled={!textInput.trim() || isLoadingText}
            >
              {isLoadingText ? 'Adding...' : 'Add Text'}
            </button>
          </div>
          <div className="border-t border-gray-700 pt-4">
            <h2 className="text-xl font-semibold mb-2">Crawl Website</h2>
            <div className="flex">
              <input
                type="url"
                className="flex-1 bg-gray-800 border border-gray-600 rounded-l-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={isLoadingUrl}
              />
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-r-md disabled:bg-gray-500"
                onClick={handleCrawlUrl}
                disabled={!urlInput.trim() || isLoadingUrl}
              >
                {isLoadingUrl ? 'Crawling...' : 'Crawl'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Chat */}
        <div className="w-2/3 p-4 flex flex-col">
          <div className="flex-1 overflow-y-auto mb-4 p-4 bg-gray-800 rounded-md">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`mb-4 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                <span className={`inline-block p-3 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  {msg.text}
                </span>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    <h4 className="font-bold">Sources:</h4>
                    <ul className="list-disc list-inside">
                      {msg.sources.map((source, i) => (
                        <li key={i} className="truncate">
                          <a href={source.metadata.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {source.metadata.source}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {isLoadingChat && <div className="text-left"><span className="inline-block p-2 rounded-lg bg-gray-700">...</span></div>}
          </div>
          <div className="flex">
            <input
              type="text"
              className="flex-1 bg-gray-800 border border-gray-600 rounded-l-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your message..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isLoadingChat}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-md disabled:bg-gray-500"
              onClick={handleSendMessage}
              disabled={!chatMessage.trim() || isLoadingChat}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Footer: File Upload */}
      <footer className="p-4 border-t border-gray-700 flex justify-center items-center">
        <input
          type="file"
          id="file-upload"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.txt,.docx"
          disabled={isLoadingFile}
        />
        <button
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded cursor-pointer disabled:bg-gray-500"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoadingFile}
        >
          {isLoadingFile ? 'Uploading...' : 'Upload File'}
        </button>
      </footer>
    </div>
  );
};

export default Home;
