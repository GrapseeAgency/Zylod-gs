'use client';

import React, { useState, useEffect } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Bell, BellRing, LayoutGrid, PackageOpen } from 'lucide-react';
import { motion } from 'framer-motion';

interface Category {
  id: string;
  slug: string;
  name: string;
  productsCount: number;
  hasNewArrivals: boolean;
  notificationsEnabled: boolean;
}

export function FavoriteCategoriesPage() {
  const { goBack, navigate } = useNavigationStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/categories?favorited=true');
        if (!res.ok) throw new Error('Failed to fetch categories');
        const data = await res.json();
        setCategories(data.categories || data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const toggleNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCategories(prev => prev.map(c => c.id === id ? { ...c, notificationsEnabled: !c.notificationsEnabled } : c));
    // API call would go here
  };

  const handleUnfollow = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCategories(prev => prev.filter(c => c.id !== id));
    // API call would go here
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center sticky top-0 z-10">
        <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 md:hidden">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="text-lg md:text-2xl font-semibold ml-2">Favorite Categories</h1>
      </header>

      <main className="flex-1 p-4 pb-20 md:p-6 md:pb-8 md:max-w-5xl md:mx-auto w-full">
        <p className="text-sm text-gray-600 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
          Get updates on new arrivals in your favorite categories
        </p>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <LayoutGrid className="w-16 h-16 mb-4 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-700">No favorite categories yet</h2>
            <button onClick={() => navigate('category-browser')} className="mt-4 px-6 py-2 bg-primary text-white rounded-full font-medium">
              Browse Categories
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {categories.map((cat, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={cat.id}
                  onClick={() => navigate('category-products', { categorySlug: cat.slug })}
                  className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 shadow-sm border border-gray-100 relative cursor-pointer active:scale-95 transition-transform"
                >
                  {cat.hasNewArrivals && (
                    <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
                      NEW
                    </span>
                  )}
                  
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <PackageOpen className="w-5 h-5" />
                    </div>
                    <button 
                      onClick={(e) => toggleNotification(e, cat.id)}
                      className={`p-1.5 rounded-full ${cat.notificationsEnabled ? 'text-primary bg-primary/10' : 'text-gray-400 bg-gray-100'}`}
                    >
                      {cat.notificationsEnabled ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    </button>
                  </div>

                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{cat.name}</h3>
                  <p className="text-xs text-gray-500 mb-4">{cat.productsCount.toLocaleString()} products</p>

                  <button 
                    onClick={(e) => handleUnfollow(e, cat.id)}
                    className="w-full text-xs font-medium text-gray-600 bg-white border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50"
                  >
                    Unfollow
                  </button>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t">
              <h3 className="font-semibold text-gray-900 mb-3">Explore More</h3>
              <button onClick={() => navigate('category-browser')} className="w-full py-3 bg-gray-100 text-gray-800 font-medium rounded-xl flex items-center justify-center gap-2">
                <LayoutGrid className="w-4 h-4" /> Explore All Categories
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default FavoriteCategoriesPage;
