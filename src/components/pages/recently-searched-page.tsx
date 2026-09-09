'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Trash2, Search, Clock, TrendingUp, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SearchHistory {
  id: string;
  query: string;
  searchedAt: string;
}

export function RecentlySearchedPage() {
  const { goBack, navigate } = useNavigationStore();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/search/history');
        if (res.ok) {
          const { data } = await res.json();
          setHistory(data);
        }
      } catch (error) {
        console.error('Failed to fetch search history', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleSearch = (term: string) => {
    if (term.trim()) {
      navigate('search-results', { query: term });
    }
  };

  const removeHistoryItem = async (term: string) => {
    try {
      await fetch(`/api/search/history?term=${encodeURIComponent(term)}`, { method: 'DELETE' });
      setHistory(prev => prev.filter(item => item.query !== term));
    } catch (error) {
      console.error('Failed to remove history item', error);
    }
  };

  const clearAll = async () => {
    try {
      await fetch('/api/search/history', { method: 'DELETE' });
      setHistory([]);
    } catch (error) {
      console.error('Failed to clear search history', error);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white px-4 py-3 border-b space-y-3 md:px-6">
        <div className="hidden md:flex items-center justify-between md:max-w-3xl md:mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Recent Searches</h1>
          {history.length > 0 && (
            <button onClick={clearAll} className="text-sm font-medium text-[#C8102E]">Clear all</button>
          )}
        </div>
        <div className="flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="md:hidden p-1 -ml-1 text-gray-800">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Search</h1>
          </div>
          {history.length > 0 && (
            <button onClick={clearAll} className="text-sm font-medium text-[#C8102E]">
              Clear all
            </button>
          )}
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            autoFocus
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#C8102E] focus:border-[#C8102E] sm:text-sm transition-colors"
            placeholder="Search products, suppliers, or categories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto md:px-6">
        <div className="md:max-w-3xl md:mx-auto">
        {loading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {history.length > 0 && (
              <div className="p-4 bg-white mb-2 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" /> Recent Searches
                </h2>
                <div className="space-y-1">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between group py-2">
                      <button 
                        className="flex-1 text-left text-sm text-gray-600 truncate"
                        onClick={() => handleSearch(item.query)}
                      >
                        {item.query}
                      </button>
                      <button 
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
                        onClick={() => removeHistoryItem(item.query)}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-white shadow-sm mb-2">
              <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" /> Trending Searches
              </h2>
              <div className="flex flex-wrap gap-2">
                {['Industrial Equipment', 'Bulk Packaging', 'Office Supplies', 'Electronics Wholesale'].map((term) => (
                  <button
                    key={term}
                    onClick={() => handleSearch(term)}
                    className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-xs font-medium text-gray-700 rounded-full transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default RecentlySearchedPage;
