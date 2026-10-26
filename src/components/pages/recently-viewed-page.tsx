'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { useCartStore, type CartItemData } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trash2, Heart, ShoppingCart, EyeOff, Loader2, LogIn, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * THE RECENTLY-VIEWED PAGE (Task 104) — backed by the real browsingHistory
 * rail. Every button does what its label says:
 * - card tap → PDP (the view gets re-recorded there, bumping recency)
 * - Heart    → real wishlist add/remove through /api/wishlist
 * - Cart     → real cart line (MOQ quantity, tier-resolved unit price)
 * - per-item trash → DELETE ?productId (server-scoped, count-verified)
 * - header trash  → DELETE (clears ALL of the signed-in buyer's history)
 * Guests get an honest sign-in prompt — the rail is buyer-scoped by design,
 * so "no history yet" would be a lie for someone who cannot have any.
 */

interface PriceTier {
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  currency: string;
  unit: string;
  moq: number;
  stockQuantity: number;
  ratingAvg: number;
  reviewCount: number;
  thumbnailUrl: string | null;
  isActive: boolean;
  maxOrderQty: number | null;
  bundleSize: number | null;
  weightKg: number | null;
  supplier: { id: string; companyName: string; isVerified: boolean };
  priceTiers: PriceTier[];
}

interface RecentlyViewedItem {
  id: string;
  viewedAt: string;
  product: Product;
}

interface WishlistRow {
  id: string;
  product: { id: string };
}

function resolveUnitPrice(p: Product, qty: number): number {
  const tiers = [...(p.priceTiers || [])].sort((a, b) => a.minQty - b.minQty);
  let price = p.basePrice;
  for (const t of tiers) {
    if (qty >= t.minQty) price = t.pricePerUnit;
  }
  return price;
}

export function RecentlyViewedPage() {
  const { goBack, navigate } = useNavigationStore();
  const { toast } = useToast();
  const addItem = useCartStore((s) => s.addItem);
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [unauth, setUnauth] = useState(false);
  // productId → wishlist item id (null = not wishlisted). Fetched once so the
  // Heart reflects the real wishlist state instead of guessing.
  const [wishlistIds, setWishlistIds] = useState<Record<string, string | null>>({});
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  // thumbnailUrl values can be dead (moved files, bad uploads) — render an
  // honest package glyph instead of the browser's broken-image artifact.
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  const observerTarget = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async (cursor?: string | null) => {
    try {
      const url = new URL('/api/products/recently-viewed', window.location.origin);
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), { credentials: 'include' });
      if (res.status === 401) {
        setUnauth(true);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');

      const { data, meta } = await res.json();

      if (cursor) {
        setItems((prev) => [...prev, ...data]);
      } else {
        setItems(data);
      }

      setNextCursor(meta.nextCursor);
      setHasMore(meta.hasMore);
    } catch (error) {
      console.error('Error fetching recently viewed:', error);
      toast({ title: 'Could not load history', description: 'Please try again in a moment.' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [toast]);

  // Real wishlist state for the hearts (first page is plenty for context).
  useEffect(() => {
    if (unauth) return;
    fetch('/api/wishlist?limit=50', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.data) return;
        const map: Record<string, string | null> = {};
        for (const row of j.data as WishlistRow[]) {
          if (row?.product?.id) map[row.product.id] = row.id;
        }
        setWishlistIds(map);
      })
      .catch(() => { /* hearts default to unwishlisted; the toggle still works */ });
  }, [unauth]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setLoadingMore(true);
          fetchItems(nextCursor);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, nextCursor, fetchItems]);

  const clearAll = async () => {
    try {
      const res = await fetch('/api/products/recently-viewed', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('clear failed');
      setItems([]);
      setHasMore(false);
      setNextCursor(null);
      toast({ title: 'History cleared', description: 'Your viewing history is empty now.' });
    } catch (error) {
      console.error('Error clearing history:', error);
      toast({ title: 'Could not clear history', description: 'Please try again.' });
    }
  };

  const removeOne = async (item: RecentlyViewedItem) => {
    setBusyIds((m) => ({ ...m, [item.id]: true }));
    try {
      const res = await fetch(`/api/products/recently-viewed?productId=${encodeURIComponent(item.product.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('remove failed');
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast({ title: 'Removed', description: `${item.product.name} removed from your history.` });
    } catch (error) {
      console.error('Error removing history item:', error);
      toast({ title: 'Could not remove', description: 'Please try again.' });
    } finally {
      setBusyIds((m) => ({ ...m, [item.id]: false }));
    }
  };

  const toggleWishlist = async (item: RecentlyViewedItem) => {
    const p = item.product;
    const existingId = wishlistIds[p.id];
    setBusyIds((m) => ({ ...m, [`w-${item.id}`]: true }));
    try {
      if (existingId) {
        const res = await fetch(`/api/wishlist/${existingId}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error('unwish failed');
        setWishlistIds((m) => ({ ...m, [p.id]: null }));
        toast({ title: 'Removed from Wishlist', description: `${p.name} removed from your wishlist` });
      } else {
        const res = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productId: p.id }),
        });
        if (!res.ok) throw new Error('wish failed');
        const j = await res.json().catch(() => null);
        setWishlistIds((m) => ({ ...m, [p.id]: j?.data?.id ?? 'added' }));
        toast({ title: 'Added to Wishlist', description: `${p.name} added to your wishlist` });
      }
    } catch (error) {
      console.error('Wishlist toggle error:', error);
      toast({ title: 'Could not update wishlist', description: 'Please try again.' });
    } finally {
      setBusyIds((m) => ({ ...m, [`w-${item.id}`]: false }));
    }
  };

  const addToCart = (item: RecentlyViewedItem) => {
    const p = item.product;
    // t197 ACCOUNT WALL — a guest never grows a cart (PDP parity).
    if (!useAuthStore.getState().isAuthenticated) {
      toast({ title: 'Sign in required', description: 'Create a Zylod account or sign in to add products to your cart.' });
      navigate('login');
      return;
    }
    // MOQ quantity, tier-resolved unit price — the same pricing rule the PDP
    // applies, so the cart line here can never disagree with the PDP line.
    const quantity = p.moq || 1;
    const unitPrice = resolveUnitPrice(p, quantity);
    const cartItem: CartItemData = {
      id: `cart-${p.id}-default-${Date.now()}`,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      productImage: p.thumbnailUrl,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      moq: p.moq,
      maxOrderQty: p.maxOrderQty,
      supplierId: p.supplier?.id || '',
      supplierName: p.supplier?.companyName || 'Supplier',
      // supplierProfiles has no slug column — honest empty, never invented.
      supplierSlug: '',
      unit: p.unit,
      bundleSize: p.bundleSize ?? null,
      weightKg: p.weightKg ?? null,
      priceTiers: (p.priceTiers || []).map((t) => ({
        minQty: t.minQty,
        maxQty: t.maxQty,
        pricePerUnit: t.pricePerUnit,
      })),
      basePrice: p.basePrice,
      variantPriceOverride: null,
    };
    addItem(cartItem);
    toast({ title: 'Added to Cart', description: `${quantity} ${p.unit} of ${p.name} added` });
  };

  const groupItems = () => {
    const groups: { [key: string]: RecentlyViewedItem[] } = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Older: [],
    };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayMs = 24 * 60 * 60 * 1000;

    items.forEach((item) => {
      const d = new Date(item.viewedAt);
      if (d >= startOfToday) groups['Today'].push(item);
      else if (d >= new Date(startOfToday.getTime() - dayMs)) groups['Yesterday'].push(item);
      else if (d >= new Date(startOfToday.getTime() - 7 * dayMs)) groups['This Week'].push(item);
      else groups['Older'].push(item);
    });

    return Object.entries(groups).filter(([, group]) => group.length > 0);
  };

  const displayPrice = (p: Product) => {
    // Task 55-c parity with the PDP: a bundle price is PER BUNDLE — the card
    // shows the honest per-unit kom-dam figure the PDP shows.
    const isBundle = p.bundleSize != null && p.bundleSize > 1;
    return isBundle && p.bundleSize ? p.basePrice / p.bundleSize : p.basePrice;
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <header className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="w-32 h-6" />
          </div>
        </header>
        <div className="p-4 space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="w-full h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (unauth) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-4 py-4 border-b flex items-center md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="md:hidden p-1 -ml-1" aria-label="Go back">
              <ArrowLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Recently Viewed</h1>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-10">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4">
            <LogIn className="w-8 h-8 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Sign in to see your history</h2>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-6">
            Recently viewed products are saved to your account, so you can pick up where you left off on any device.
          </p>
          <Button
            className="bg-primary hover:bg-[#A30D25] text-white px-8"
            onClick={() => navigate('login')}
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-4 py-4 border-b flex items-center justify-between md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="md:hidden p-1 -ml-1" aria-label="Go back">
            <ArrowLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Recently Viewed</h1>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            aria-label="Clear all history"
            className="p-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </header>

      <div className="px-4 py-2 md:px-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Products you&apos;ve checked out recently</p>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-10">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4">
            <EyeOff className="w-8 h-8 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No recently viewed products</h2>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-6">Your browsing history will appear here.</p>
          <Button
            className="bg-primary hover:bg-[#A30D25] text-white px-8"
            onClick={() => navigate('home')}
          >
            Start exploring
          </Button>
        </div>
      ) : (
        <div className="flex-1 p-4 space-y-6 md:p-6 md:max-w-4xl md:mx-auto md:w-full">
          {groupItems().map(([groupName, group]) => (
            <div key={groupName}>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{groupName}</h3>
              <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                <AnimatePresence>
                  {group.map((item) => {
                    const wished = !!wishlistIds[item.product.id];
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex gap-3 relative overflow-hidden"
                        onClick={() => navigate('product-detail', { productId: item.product.id })}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); removeOne(item); }}
                          disabled={!!busyIds[item.id]}
                          aria-label={`Remove ${item.product.name} from history`}
                          className="absolute top-2 right-2 p-1 text-gray-300 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-900 rounded-lg flex-shrink-0 relative">
                          {item.product.thumbnailUrl && !brokenThumbs[item.id] ? (
                            <img
                              src={item.product.thumbnailUrl}
                              alt={item.product.name}
                              className="w-full h-full object-cover rounded-lg"
                              onError={() => setBrokenThumbs((m) => ({ ...m, [item.id]: true }))}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
                              <Package className="w-7 h-7 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-between pr-5">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{item.product.name}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                              {item.product.supplier?.companyName || 'Supplier'}
                              {item.product.supplier?.isVerified && (
                                <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">VERIFIED</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div>
                              <span className="text-primary font-bold text-sm">
                                {item.product.currency} {displayPrice(item.product).toFixed(2)}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-1">
                                / {item.product.unit}{(item.product.bundleSize != null && item.product.bundleSize > 1) ? ` · per ${item.product.unit === 'bundle' ? 'pc' : 'unit'}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className={`p-1.5 rounded-full transition-colors ${wished ? 'text-primary bg-red-50' : 'text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-red-50'}`}
                                disabled={!!busyIds[`w-${item.id}`]}
                                aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
                                onClick={(e) => { e.stopPropagation(); toggleWishlist(item); }}
                              >
                                <Heart className={`w-4 h-4 ${wished ? 'fill-current' : ''}`} />
                              </button>
                              <button
                                className="p-1.5 bg-primary text-white rounded-full shadow-sm hover:bg-[#A30D25] transition-colors"
                                aria-label="Add MOQ to cart"
                                onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                              >
                                <ShoppingCart className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}

          <div ref={observerTarget} className="h-4 w-full flex justify-center py-4">
            {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>
        </div>
      )}
    </div>
  );
}

export default RecentlyViewedPage;
