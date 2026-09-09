'use client';

import React, { useState, useEffect } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Building2, MapPin, Star, Heart, CheckCircle2, ChevronDown, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

// Types
interface Supplier {
  id: string;
  name: string;
  location: string;
  country: string;
  rating: number;
  reviewCount: number;
  categories: string[];
  isVerified: boolean;
  productsCount: number;
}

export function FavoriteSuppliersPage() {
  const { goBack, navigate } = useNavigationStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and Sort
  const [sortBy, setSortBy] = useState('Recently Added');

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/suppliers?favorited=true');
        if (!res.ok) throw new Error('Failed to fetch favorite suppliers');
        const data = await res.json();
        setSuppliers(data.suppliers || data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSuppliers();
  }, []);

  const handleRemoveFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Optimistic update
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/suppliers/${id}/favorite`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to remove favorite', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 md:hidden">
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-lg font-semibold flex-1 ml-2">Favorite Suppliers</h1>
        </div>
      </header>

      {/* Sort & Filter */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <button className="flex items-center text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
          Sort: {sortBy} <ChevronDown className="w-4 h-4 ml-1" />
        </button>
        <button className="flex items-center text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
          <Filter className="w-4 h-4 mr-1" /> Filter
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 md:max-w-6xl md:mx-auto w-full">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white p-4 rounded-xl shadow-sm animate-pulse flex gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded mt-2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-10">{error}</div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Building2 className="w-16 h-16 mb-4 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-700">No favorite suppliers yet</h2>
            <p className="text-sm mt-1">Suppliers you favorite will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((supplier) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={supplier.id}
                onClick={() => navigate('seller-profile', { supplierId: supplier.id })}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start gap-4">
                  {/* Logo Placeholder */}
                  <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                    {supplier.name.substring(0, 2).toUpperCase()}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{supplier.name}</h3>
                      <button 
                        onClick={(e) => handleRemoveFavorite(e, supplier.id)}
                        className="p-1 -mr-1 text-primary"
                      >
                        <Heart className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-500 mt-1 gap-2">
                      <span className="flex items-center"><MapPin className="w-3 h-3 mr-0.5" /> {supplier.location}</span>
                      {supplier.isVerified && (
                        <span className="flex items-center text-green-600 font-medium">
                          <CheckCircle2 className="w-3 h-3 mr-0.5" /> Verified
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center mt-2 gap-1 text-sm">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-medium">{supplier.rating}</span>
                      <span className="text-gray-400 text-xs">({supplier.reviewCount})</span>
                      <span className="mx-2 text-gray-300">•</span>
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {supplier.productsCount} Products
                      </span>
                    </div>

                    <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                      {supplier.categories.slice(0, 3).map((cat, idx) => (
                        <span key={idx} className="text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/5 px-2 py-1 rounded">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-50">
                  <button className="w-full text-center text-primary font-medium text-sm py-1">
                    View Catalog
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default FavoriteSuppliersPage;
