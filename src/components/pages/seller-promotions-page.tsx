'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { Plus, Tag } from 'lucide-react';

export function SellerPromotionsPage() {
  const { navigate, goBack } = useNavigationStore();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/promotions')
      .then(res => res.json())
      .then(d => {
        setPromotions(d?.promotions || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4">←</button>
          <h1 className="text-xl font-bold">Promotions</h1>
        </div>
        <button onClick={() => navigate('create-promotion')} className="bg-white text-primary p-2 rounded-full">
          <Plus className="w-5 h-5" />
        </button>
      </header>
      <main className="flex-1 p-4 md:p-6 md:max-w-4xl md:mx-auto md:w-full">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {promotions.map(promo => (
              <div key={promo.id} className="bg-white p-4 rounded shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{promo.title}</h3>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded mt-1">{promo.status}</span>
                  </div>
                  <Tag className="text-primary" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Redemptions</p>
                    <p className="font-bold">{promo.redemptions || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Revenue</p>
                    <p className="font-bold">৳{promo.revenue || 0}</p>
                  </div>
                </div>
                <button onClick={() => navigate('promotion-analytics', { id: promo.id })} className="mt-4 w-full py-2 bg-gray-100 text-center rounded font-semibold text-gray-700">
                  View Analytics
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default SellerPromotionsPage;