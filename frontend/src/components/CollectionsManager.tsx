"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';

interface CollectionsManagerProps {
  apiUrl: string;
  activeCollection: string;
  onActiveChange: (name: string) => Promise<void> | void;
}

export function CollectionsManager({ apiUrl, activeCollection, onActiveChange }: CollectionsManagerProps) {
  const [collections, setCollections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const fetchCollections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${apiUrl}/collections`);
      if (res.data?.success) {
        setCollections(res.data.collections || []);
      } else if (Array.isArray(res.data?.collections)) {
        setCollections(res.data.collections);
      } else {
        setCollections([]);
      }
    } catch (e) {
      setError('Failed to fetch collections');
      setCollections([]);
    } finally {
      setIsLoading(false);
    }
  };

  const activateCollection = async (name: string) => {
    if (!name || name === activeCollection) return;
    setIsLoading(true);
    setError(null);
    try {
      await axios.post(`${apiUrl}/collections/use`, { collectionName: name });
      await onActiveChange(name);
      await fetchCollections();
    } catch {
      setError('Failed to use/create collection');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  return (
    <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
          </svg>
          <h3 className="font-semibold">Collections</h3>
        </div>
        <button
          onClick={fetchCollections}
          disabled={isLoading}
          className="text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded px-2 py-1 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="text-xs text-red-300 mb-2">{error}</div>}

      <div className="mb-3">
        <label className="text-xs text-white/80 block mb-1">Active Collection</label>
        <select
          value={activeCollection}
          onChange={(e) => activateCollection(e.target.value)}
          className="w-full bg-white/5 border border-white/20 text-white focus:border-indigo-400 focus:ring-indigo-400/20 rounded-md p-2 text-sm"
        >
          {[activeCollection, ...collections.filter(c => c !== activeCollection)].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="New collection name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              const name = newName.trim();
              if (!name) return;
              await activateCollection(name);
              setNewName('');
            }
          }}
          className="flex-1 bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-md p-2 text-sm"
        />
        <button
          onClick={async () => {
            const name = newName.trim();
            if (!name) return;
            await activateCollection(name);
            setNewName('');
          }}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 rounded-md px-3 text-sm"
        >Create/Use</button>
      </div>
    </div>
  );
}

