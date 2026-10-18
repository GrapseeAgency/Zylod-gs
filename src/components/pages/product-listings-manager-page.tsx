'use client';

/**
 * Product listings manager (Task 50-a) — REAL moderation states from
 * products.isApproved/isActive (no fabricated statuses):
 *   'Pending review' → isApproved=false, isActive=true (fresh creations)
 *   'Approved'       → isApproved=true,  isActive=true
 *   'Hidden'         → isActive=false    (soft-deleted or manually hidden)
 * Real actions only: Edit (owner-gated GET hydrates the edit page), Hide/Show
 * (isActive PATCH), Remove (SOFT delete — order history is preserved). The old
 * View/Duplicate/Trash buttons did nothing at all and are gone.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, Plus, Edit, Eye, EyeOff, Trash2, RefreshCw,
  AlertTriangle, LogIn, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { useCurrencyStore } from '@/store/currency-store';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface ApiProduct {
  id: string;
  name: string;
  basePrice: number;
  currency: string;
  stockQuantity: number;
  isActive: boolean;
  isApproved: boolean;
  thumbnailUrl: string | null;
  category: { id: string; name: string; slug: string } | null;
}

type ListingTab = 'all' | 'pending' | 'approved' | 'inactive' | 'out_of_stock';

const TABS: Array<{ id: ListingTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending review' },
  { id: 'approved', label: 'Approved' },
  { id: 'inactive', label: 'Hidden' },
  { id: 'out_of_stock', label: 'Out of stock' },
];

/** Real moderation chip — derived ONLY from isApproved/isActive. */
function ModerationChip({ product }: { product: ApiProduct }) {
  if (!product.isActive) {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
        Hidden
      </span>
    );
  }
  if (!product.isApproved) {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        Pending review
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      Approved
    </span>
  );
}

export function ProductListingsManagerPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);
  const { formatPrice } = useCurrencyStore();

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<ListingTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [actingId, setActingId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ApiProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const seqRef = useRef(0);

  const fetchProducts = useCallback(async (background = false) => {
    const seq = ++seqRef.current;
    if (background) setRefreshing(true);
    else {
      setLoading(true);
      setError('');
    }
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (activeTab !== 'all') qs.set('status', activeTab);
      const res = await fetch(`/api/supplier/products?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      if (seq !== seqRef.current) return;
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true);
        setProducts([]);
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message = json?.error || `Failed to load listings (HTTP ${res.status})`;
        setError(message);
        return;
      }
      setProducts(Array.isArray(json.data?.items) ? json.data.items : []);
      setTotal(typeof json.data?.total === 'number' ? json.data.total : 0);
      setNeedsAuth(false);
    } catch {
      if (seq !== seqRef.current) return;
      setError('Network error while loading your listings. Check your connection and retry.');
    } finally {
      if (seq === seqRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [activeTab, token]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleToggleVisibility = async (product: ApiProduct) => {
    if (actingId) return;
    setActingId(product.id);
    try {
      const res = await fetch(`/api/supplier/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message = json?.error || `Could not update visibility (HTTP ${res.status})`;
        toast.error(message);
        return;
      }
      // Apply the server's real row.
      const updated = json.data as { id: string; isActive: boolean };
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, isActive: updated.isActive } : p)));
      toast.success(updated.isActive ? 'Listing shown again (still subject to approval state)' : 'Listing hidden from the storefront');
    } catch {
      toast.error('Network error — visibility change was not saved.');
    } finally {
      setActingId('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/supplier/products/${confirmDelete.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message = json?.error || `Could not remove the listing (HTTP ${res.status})`;
        toast.error(message);
        return;
      }
      toast.success(json.message || 'Listing removed from the storefront');
      setConfirmDelete(null);
      fetchProducts(true);
    } catch {
      toast.error('Network error — the listing was not removed.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (needsAuth) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Product Listings</h1>
        </div>
        <div className="p-4 max-w-3xl mx-auto md:p-6 md:pt-10">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center space-y-4">
            <LogIn className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-700">Sign in as a supplier to manage your product listings.</p>
            <button
              onClick={() => navigate('login')}
              className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium"
            >
              Sign in
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 rounded-full flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Product Listings</h1>
          </div>
          <button
            onClick={() => navigate('seller-add-product')}
            className="min-h-11 bg-primary text-white px-4 rounded-lg flex items-center gap-1 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 min-h-9 flex items-center rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4 md:p-6 md:pt-4 md:max-w-6xl md:mx-auto">
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Listings</h1>
            <p className="text-xs text-gray-500 mt-1">
              {total} listing{total === 1 ? '' : 's'} total — new listings await admin approval before buyers see them
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts(true)}
              disabled={refreshing}
              className="min-h-11 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 flex items-center gap-2 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={() => navigate('seller-add-product')}
              className="min-h-11 bg-primary text-white px-4 rounded-lg flex items-center gap-1 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden md:flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 min-h-9 flex items-center rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              aria-label="Search your listings"
              placeholder="Search listings…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-11 pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700">
              {error}
              <button onClick={() => fetchProducts()} className="block mt-1 underline font-medium">Retry</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 animate-pulse flex gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                    {product.thumbnailUrl ? (
                       
                      <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
                      <ModerationChip product={product} />
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{product.category?.name ?? 'Uncategorized'}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-primary">{formatPrice(product.basePrice)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        product.stockQuantity > 20 ? 'bg-green-50 text-green-600' : product.stockQuantity > 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => navigate('seller-edit-product', { productId: product.id })}
                    className="min-h-11 flex flex-col items-center justify-center p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4 mb-1" />
                    <span className="text-xs font-medium">Edit</span>
                  </button>
                  <button
                    onClick={() => handleToggleVisibility(product)}
                    disabled={actingId === product.id}
                    className="min-h-11 flex flex-col items-center justify-center p-2 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50"
                  >
                    {product.isActive ? <EyeOff className="w-4 h-4 mb-1" /> : <Eye className="w-4 h-4 mb-1" />}
                    <span className="text-xs font-medium">{product.isActive ? 'Hide' : 'Show'}</span>
                  </button>
                  <button
                    onClick={() => setConfirmDelete(product)}
                    className="min-h-11 flex flex-col items-center justify-center p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 mb-1" />
                    <span className="text-xs font-medium">Remove</span>
                  </button>
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="text-center py-10">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  {searchQuery ? 'No listings match your search.' : 'No listings in this state yet.'}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-gray-500 mt-1">
                    Publish your first product — it will appear here as “Pending review” until an admin approves it.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Soft-delete confirmation — order history is preserved; the listing is hidden */}
      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this listing?</DialogTitle>
            <DialogDescription>
              “{confirmDelete?.name}” will be hidden from the storefront. This is a soft removal — past order
              history is preserved and the listing can be shown again by editing it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="min-h-11 px-4 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="min-h-11 px-4 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? 'Removing…' : 'Remove listing'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default ProductListingsManagerPage;
