'use client';

import React, { useState, useEffect } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, ShieldCheck, TrendingDown, TrendingUp, AlertCircle, ShoppingCart, Heart, Trash2 } from 'lucide-react';

interface SavedItem {
  id: string;
  productId: string;
  name: string;
  imageUrl: string;
  currentPrice: number;
  savedPrice: number;
  moq: number;
  inStock: boolean;
  savedAt: string;
  supplier: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  specs: Record<string, string>;
}

export function SaveForLaterDetailPage({ pageParams }: { pageParams?: any }) {
  const itemId = pageParams?.itemId;
  const { goBack, navigate } = useNavigationStore();
  const [item, setItem] = useState<SavedItem | null>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (itemId) {
          const res = await fetch(`/api/save-for-later/${itemId}`);
          if (res.ok) {
            const data = await res.json();
            setItem(data.item || data);
            
            // fetch similar
            if (data.supplier?.id) {
              const simRes = await fetch(`/api/products?supplierId=${data.supplier.id}&limit=4`);
              if (simRes.ok) {
                const simData = await simRes.json();
                setSimilar(simData.products || simData || []);
              }
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [itemId]);

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!item) {
    return <div className="min-h-screen flex items-center justify-center flex-col"><p>Item not found</p><button onClick={() => goBack()} className="mt-4 text-primary">Go back</button></div>;
  }

  const priceDiff = item.currentPrice - item.savedPrice;
  const percentDiff = (Math.abs(priceDiff) / item.savedPrice) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8">
      <header className="bg-white border-b px-4 py-3 flex items-center sticky top-0 z-20 md:px-6">
        <button onClick={() => goBack()} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-lg font-semibold ml-2">Saved Item</h1>
      </header>

      <main className="flex-1">
        {/* Product Info */}
        <section className="bg-white p-4 mb-2">
          <div className="w-full aspect-square bg-gray-100 rounded-xl mb-4 overflow-hidden">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
            )}
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-600 cursor-pointer hover:underline" onClick={() => navigate('seller-profile', { supplierId: item.supplier.id })}>
              {item.supplier.name}
            </span>
            {item.supplier.isVerified && <ShieldCheck className="w-4 h-4 text-green-600" />}
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 leading-tight mb-4">{item.name}</h2>

          <div className="flex items-end gap-3 mb-4">
            <span className="text-3xl font-bold text-gray-900">${item.currentPrice.toFixed(2)}</span>
            <span className="text-sm text-gray-500 mb-1">/ unit</span>
          </div>

          {priceDiff !== 0 && (
            <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${priceDiff > 0 ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
              {priceDiff > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <div>
                <p className="text-sm font-medium">Price {priceDiff > 0 ? 'increased' : 'dropped'} by {percentDiff.toFixed(1)}%</p>
                <p className="text-xs opacity-80">Was ${item.savedPrice.toFixed(2)} when saved on {new Date(item.savedAt).toLocaleDateString()}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
              MOQ: {item.moq} units
            </span>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${item.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {item.inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>
        </section>

        {/* Specs */}
        {item.specs && Object.keys(item.specs).length > 0 && (
          <section className="bg-white p-4 mb-2">
            <h3 className="font-semibold text-gray-900 mb-3">Specifications</h3>
            <div className="space-y-2">
              {Object.entries(item.specs).map(([key, val]) => (
                <div key={key} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{key}</span>
                  <span className="font-medium text-gray-900">{val}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Similar Products */}
        {similar.length > 0 && (
          <section className="bg-white p-4">
            <h3 className="font-semibold text-gray-900 mb-4">More from this supplier</h3>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {similar.map(prod => (
                <div key={prod.id} onClick={() => navigate('product-detail', { productId: prod.id })} className="w-32 flex-shrink-0 cursor-pointer">
                  <div className="w-32 h-32 bg-gray-100 rounded-lg mb-2 overflow-hidden">
                    {prod.imageUrl && <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />}
                  </div>
                  <h4 className="text-xs font-medium text-gray-900 line-clamp-2">{prod.name}</h4>
                  <p className="font-bold text-sm mt-1">${prod.price?.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 space-y-3">
        <button className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50" disabled={!item.inStock}>
          <ShoppingCart className="w-5 h-5" /> Move to Cart
        </button>
        <div className="flex gap-3">
          <button className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50">
            <Heart className="w-4 h-4" /> Wishlist
          </button>
          <button className="flex-1 py-2.5 border border-gray-300 text-red-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> Remove
          </button>
        </div>
      </footer>
    </div>
  );
}

export default SaveForLaterDetailPage;
