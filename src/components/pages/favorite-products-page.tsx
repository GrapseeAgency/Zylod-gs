'use client';

import React, { useState, useEffect } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, LayoutGrid, List, ArrowDownUp, Filter, Star, ShoppingCart, Heart, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  rating: number;
  reviews: number;
  inStock: boolean;
  hasBulkPricing: boolean;
  supplier: {
    name: string;
    isVerified: boolean;
  };
}

export function FavoriteProductsPage() {
  const { goBack, navigate } = useNavigationStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/favorites');
        if (!res.ok) throw new Error('Failed to fetch favorite products');
        const data = await res.json();
        setProducts(data.products || data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFavorites();
  }, []);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleCompare = () => {
    if (selectedIds.size >= 2 && selectedIds.size <= 4) {
      navigate('compare', { productIds: Array.from(selectedIds).join(',') });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-[calc(var(--bottom-nav-h)+140px)]">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-1 rounded-full hover:bg-gray-100 md:hidden">
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-lg font-semibold">Favorite Products</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="p-2 rounded-full hover:bg-gray-100">
            {viewMode === 'grid' ? <List className="w-5 h-5 text-gray-600" /> : <LayoutGrid className="w-5 h-5 text-gray-600" />}
          </button>
        </div>
      </header>

      {/* Filters & Actions */}
      <div className="bg-white border-b py-2 px-4 flex flex-col gap-3 shadow-sm">
        <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
          {['Rating', 'Price Low-High', 'Price High-Low', 'Newest'].map((sort) => (
            <button key={sort} className="whitespace-nowrap px-3 py-1.5 bg-gray-100 text-sm font-medium rounded-full text-gray-700 flex items-center gap-1">
              {sort === 'Rating' ? <Star className="w-3 h-3" /> : <ArrowDownUp className="w-3 h-3" />} {sort}
            </button>
          ))}
          <button className="whitespace-nowrap px-3 py-1.5 bg-gray-100 text-sm font-medium rounded-full text-gray-700 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filters
          </button>
        </div>
        <div className="flex justify-between items-center text-sm">
          <label className="flex items-center gap-2 text-gray-600">
            <input type="checkbox" checked={isBatchMode} onChange={(e) => {
              setIsBatchMode(e.target.checked);
              if (!e.target.checked) setSelectedIds(new Set());
            }} className="w-4 h-4 text-primary rounded" />
            Batch Select
          </label>
          {isBatchMode && selectedIds.size > 0 && (
            <span className="font-medium text-primary">{selectedIds.size} Selected</span>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 md:max-w-6xl md:mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-gray-500 flex flex-col items-center">
            <Heart className="w-16 h-16 mb-4 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-700">No favorite products</h2>
            <p className="text-sm mt-1">Products you heart will show up here.</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" : "flex flex-col gap-3"}>
            {products.map((product) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={product.id}
                onClick={() => !isBatchMode && navigate('product-detail', { productId: product.id })}
                className={`bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 relative ${viewMode === 'list' ? 'flex p-3 gap-4' : 'flex flex-col'} ${isBatchMode ? 'cursor-pointer' : ''}`}
                onClickCapture={(e) => { if (isBatchMode) { e.stopPropagation(); toggleSelect(product.id); } }}
              >
                {isBatchMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <input type="checkbox" checked={selectedIds.has(product.id)} readOnly className="w-5 h-5 text-primary rounded shadow-sm border-gray-300" />
                  </div>
                )}
                
                <div className={`bg-gray-100 relative ${viewMode === 'list' ? 'w-28 h-28 rounded-lg flex-shrink-0' : 'w-full aspect-square'}`}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                  )}
                  <button className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full text-primary shadow-sm z-10">
                    <Heart className="w-4 h-4 fill-current" />
                  </button>
                </div>

                <div className={`flex flex-col flex-1 ${viewMode === 'grid' ? 'p-3' : 'py-1'}`}>
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{product.name}</h3>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <span className="line-clamp-1">{product.supplier.name}</span>
                    {product.supplier.isVerified && <ShieldCheck className="w-3 h-3 text-green-600" />}
                  </div>
                  
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="font-medium text-gray-700">{product.rating}</span>
                  </div>

                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <span className="font-bold text-gray-900">${product.price.toFixed(2)}</span>
                    {viewMode === 'list' && (
                      <button className="p-2 bg-primary text-white rounded-full">
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button for Batch Mode */}
      {isBatchMode && (
        <div className="fixed bottom-[var(--bottom-nav-h)] md:bottom-6 left-0 right-0 md:left-auto md:right-6 md:w-96 p-4 bg-white border-t md:border md:rounded-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none z-20">
          <button 
            disabled={selectedIds.size < 2 || selectedIds.size > 4}
            onClick={handleCompare}
            className={`w-full py-3 rounded-lg font-semibold flex justify-center items-center gap-2 transition-colors ${
              (selectedIds.size >= 2 && selectedIds.size <= 4) ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            Compare Selected {(selectedIds.size > 0) && `(${selectedIds.size})`}
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">Select 2 to 4 items to compare</p>
        </div>
      )}
    </div>
  );
}

export default FavoriteProductsPage;
