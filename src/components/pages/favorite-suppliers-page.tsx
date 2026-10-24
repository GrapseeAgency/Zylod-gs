'use client';

import React, { useState, useEffect } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Building2, MapPin, Star, Heart, CheckCircle2, ChevronDown, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// Types — mapped from the real /api/buyer/favorite-suppliers response shape:
//   { id, buyerId, supplierId, createdAt, supplier: { id, companyName, verificationStatus, ratingAvg, ratingCount, createdAt } }
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
  const [sortBy, setSortBy] = useState<'Recently Added' | 'Top Rated' | 'Most Products'>('Recently Added');

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoading(true);
        // Real endpoint — returns only suppliers the buyer actually follows.
        const res = await fetch('/api/buyer/favorite-suppliers');
        if (!res.ok) throw new Error('Failed to fetch favorite suppliers');
        const data = await res.json();
        const raw: any[] = Array.isArray(data?.data) ? data.data : [];
        const mapped: Supplier[] = raw.map((r: any) => {
          const s = r.supplier || {};
          return {
            id: s.id || r.supplierId,
            name: s.companyName || 'Unknown supplier',
            location: 'Bangladesh',
            country: 'BD',
            rating: Number(s.ratingAvg ?? 0),
            reviewCount: Number(s.ratingCount ?? 0),
            categories: [],
            isVerified: s.verificationStatus === 'APPROVED' || s.verificationStatus === 'VERIFIED',
            productsCount: 0,
          };
        });
        setSuppliers(mapped);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSuppliers();
  }, []);

  // Sort the in-memory list whenever sortBy changes
  const sortedSuppliers = React.useMemo(() => {
    const arr = [...suppliers];
    if (sortBy === 'Top Rated') arr.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'Most Products') arr.sort((a, b) => b.productsCount - a.productsCount);
    return arr;
  }, [suppliers, sortBy]);

  const handleRemoveFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Optimistic update
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    try {
      const res = await fetch(`/api/suppliers/${id}/favorite`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Removed from favorite suppliers');
    } catch (err) {
      // Re-fetch to restore honest state on failure
      toast.error('Could not remove — please try again');
      const restore = await fetch('/api/buyer/favorite-suppliers');
      if (restore.ok) {
        const data = await restore.json();
        const raw: any[] = Array.isArray(data?.data) ? data.data : [];
        setSuppliers(raw.map((r: any) => {
          const s = r.supplier || {};
          return {
            id: s.id || r.supplierId,
            name: s.companyName || 'Unknown supplier',
            location: 'Bangladesh',
            country: 'BD',
            rating: Number(s.ratingAvg ?? 0),
            reviewCount: Number(s.ratingCount ?? 0),
            categories: [],
            isVerified: s.verificationStatus === 'APPROVED' || s.verificationStatus === 'VERIFIED',
            productsCount: 0,
          };
        }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 md:hidden" aria-label="Go back">
            <ArrowLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" />
          </button>
          <h1 className="text-lg font-semibold flex-1 ml-2">Favorite Suppliers</h1>
        </div>
      </header>

      {/* Sort & Filter */}
      <div className="bg-white dark:bg-gray-900 border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => {
            const opts: Array<'Recently Added' | 'Top Rated' | 'Most Products'> = ['Recently Added', 'Top Rated', 'Most Products']
            const idx = opts.indexOf(sortBy)
            setSortBy(opts[(idx + 1) % opts.length])
          }}
          className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full min-h-11"
          aria-label={`Sort by ${sortBy}, tap to change`}
        >
          Sort: {sortBy} <ChevronDown className="w-4 h-4 ml-1" />
        </button>
        <button
          onClick={() => navigate('category-list')}
          className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full min-h-11"
          aria-label="Open filter page"
        >
          <Filter className="w-4 h-4 mr-1" /> Filter
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 md:max-w-6xl md:mx-auto w-full">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm animate-pulse flex gap-4">
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded mt-2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-10">{error}</div>
        ) : sortedSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
            <Building2 className="w-16 h-16 mb-4 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No favorite suppliers yet</h2>
            <p className="text-sm mt-1 max-w-xs text-center">Tap the Follow button on any supplier profile to add them here.</p>
            <button
              onClick={() => navigate('suppliers')}
              className="mt-4 bg-primary text-white px-5 py-2 rounded-full font-medium text-sm"
            >
              Browse Suppliers
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedSuppliers.map((supplier) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={supplier.id}
                onClick={() => navigate('seller-profile', { supplierId: supplier.id })}
                className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                    {supplier.name.substring(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{supplier.name}</h3>
                      <button
                        onClick={(e) => handleRemoveFavorite(e, supplier.id)}
                        className="p-1.5 -mr-1 -mt-1 text-primary shrink-0 min-w-11 min-h-11 flex items-center justify-center"
                        aria-label={`Unfollow ${supplier.name}`}
                      >
                        <Heart className="w-5 h-5 fill-current" />
                      </button>
                    </div>

                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 gap-2 flex-wrap">
                      <span className="flex items-center"><MapPin className="w-3 h-3 mr-0.5" /> {supplier.location}</span>
                      {supplier.isVerified && (
                        <span className="flex items-center text-green-600 font-medium">
                          <CheckCircle2 className="w-3 h-3 mr-0.5" /> Verified
                        </span>
                      )}
                    </div>

                    <div className="flex items-center mt-2 gap-1 text-sm">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-medium">{supplier.rating.toFixed(1)}</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">({supplier.reviewCount})</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-800">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate('seller-storefront', { supplierId: supplier.id }) }}
                    className="w-full text-center text-primary font-medium text-sm py-2 min-h-11"
                    aria-label={`View ${supplier.name} catalog`}
                  >
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

