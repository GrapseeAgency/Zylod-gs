'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { Star, AlertCircle, MessageSquare } from 'lucide-react';

export function SellerReviewsPage() {
  const { navigate, goBack } = useNavigationStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/reviews')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="md:hidden bg-primary text-white p-4 flex items-center">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="text-xl font-bold">Seller Reviews</h1>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Seller Reviews</h1>
      <main className="flex-1 p-4">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-bold">Rating Overview</h2>
              <div className="flex items-center space-x-2 mt-2">
                <Star className="text-yellow-500" />
                <span className="text-2xl font-bold">{data?.averageRating || '4.5'}</span>
                <span className="text-gray-500">({data?.totalReviews || 0} reviews)</span>
              </div>
            </div>
            <div className="space-y-4">
              {data?.reviews?.map((review: any) => (
                <div key={review.id} className="bg-white p-4 rounded shadow">
                  <div className="flex justify-between">
                    <span className="font-bold">{review.buyerName}</span>
                    <span className="text-sm text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-2">{review.comment}</p>
                  <div className="mt-4 flex space-x-2">
                    <button onClick={() => navigate('seller-review-reply', { id: review.id })} className="flex items-center text-primary text-sm font-semibold">
                      <MessageSquare className="w-4 h-4 mr-1" /> Reply
                    </button>
                    <button className="flex items-center text-gray-500 text-sm font-semibold">
                      <AlertCircle className="w-4 h-4 mr-1" /> Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default SellerReviewsPage;