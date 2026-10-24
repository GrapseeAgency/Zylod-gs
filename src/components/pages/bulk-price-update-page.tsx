'use client';

/**
 * Bulk Price Update (Task 175-b) — REAL hydration + REAL save.
 *
 * The previous page rendered a single hardcoded row "SHIRT-01 / $450 / MOQ 50"
 * with a "Save All" button that had NO onClick. The real rails:
 *   GET   /api/supplier/products — lists the session supplier's REAL products
 *         with all canonical relations (priceTiers, images, videos, variants).
 *   PATCH /api/supplier/products/[id] — the FULL canonical-contract replace
 *         writer. The only basePrice/MOQ writer is this full-replace.
 *
 * This page now:
 *   - loads the real products via GET /api/supplier/products (paginated),
 *   - lets the seller edit basePrice and MOQ inline,
 *   - on Save All, batches the changed products through PATCH full-replace
 *     (rebuilding each canonical payload from the loaded row, overriding
 *     only basePrice and MOQ — same pattern as the pricing-tiers page),
 *   - surfaces 409 (variant FK restrict from active carts/orders) honestly,
 *   - honest 401 / error / empty states.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RefreshCw, AlertTriangle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface ApiTier { id: string; minQty: number; maxQty: number | null; pricePerUnit: number; }
interface ApiVariant { id: string; variantName: string; variantValue: string; sku: string | null; stockQuantity: number; priceOverride: number | null; }
interface ApiImage { id: string; imageUrl: string; sortOrder: number; }
interface ApiVideo { id: string; videoUrl: string; title: string | null; sortOrder: number; }
interface ApiCategory { id: string; name: string; slug: string; }
interface ApiProduct {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  brand: string | null;
  sku: string | null;
  unit: string;
  bundleSize: number | null;
  weightKg: number | null;
  moq: number;
  maxOrderQty: number | null;
  basePrice: number;
  currency: string;
  stockQuantity: number;
  stockAlertThreshold: number | null;
  isCustomizable: boolean;
  thumbnailUrl: string | null;
  isActive: boolean;
  isApproved: boolean;
  category: ApiCategory | null;
  priceTiers: ApiTier[];
  images: ApiImage[];
  videos: ApiVideo[];
  variants: ApiVariant[];
}

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

interface EditRow {
  basePrice: string;
  moq: string;
}

const money = (n: number) => `৳${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function buildFullReplacePayload(p: ApiProduct, basePrice: number, moq: number) {
  return {
    name: p.name,
    categoryId: p.categoryId,
    description: p.description,
    ...(p.brand ? { brand: p.brand } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    unit: p.unit,
    bundleSize: p.bundleSize,
    weightKg: p.weightKg,
    moq,
    maxOrderQty: p.maxOrderQty,
    basePrice,
    currency: (p.currency || 'BDT') as 'BDT',
    stockQuantity: p.stockQuantity,
    stockAlertThreshold: p.stockAlertThreshold,
    isCustomizable: p.isCustomizable,
    thumbnailUrl: p.thumbnailUrl,
    images: p.images
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img, i) => ({ imageUrl: img.imageUrl, sortOrder: i })),
    videos: p.videos
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((v, i) => ({
        url: v.videoUrl,
        sortOrder: i,
        ...(v.title ? { title: v.title } : {}),
      })),
    variants: p.variants.map((v) => ({
      variantName: v.variantName,
      variantValue: v.variantValue,
      ...(v.sku ? { sku: v.sku } : {}),
      stockQuantity: v.stockQuantity,
      ...(v.priceOverride != null ? { priceOverride: v.priceOverride } : { priceOverride: null }),
    })),
    priceTiers: p.priceTiers
      .slice()
      .sort((a, b) => a.minQty - b.minQty)
      .map((t) => ({
        minQty: t.minQty,
        ...(t.maxQty != null ? { maxQty: t.maxQty } : { maxQty: null }),
        pricePerUnit: t.pricePerUnit,
      })),
  };
}

export function BulkPriceUpdatePage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [edits, setEdits] = useState<Record<string, EditRow>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('Sign in as a supplier to manage prices.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const url = `/api/supplier/products?page=${page}&limit=${LIMIT}${search ? `&search=${encodeURIComponent(search.trim())}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'Price management is not available on this account.');
        return;
      }
      if (!res.ok || !json?.success || !json?.data) {
        setState('error');
        setLoadError(json?.error || `Failed to load products (HTTP ${res.status})`);
        return;
      }
      const items = (json.data.items ?? []) as ApiProduct[];
      setProducts(items);
      setTotal(json.data.total ?? 0);
      setTotalPages(json.data.totalPages ?? 0);
      const nextEdits: Record<string, EditRow> = {};
      for (const p of items) {
        nextEdits[p.id] = { basePrice: String(p.basePrice), moq: String(p.moq) };
      }
      setEdits(nextEdits);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading products. Check your connection and retry.');
    }
  }, [token, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const p of products) {
      const e = edits[p.id];
      if (!e) continue;
      const priceChanged = Number(e.basePrice) !== p.basePrice;
      const moqChanged = Number(e.moq) !== p.moq;
      if (priceChanged || moqChanged) n++;
    }
    return n;
  }, [products, edits]);

  const updateEdit = (id: string, field: keyof EditRow, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveAll = async () => {
    if (saving || dirtyCount === 0) return;
    // Validate before submit
    for (const p of products) {
      const e = edits[p.id];
      if (!e) continue;
      const priceChanged = Number(e.basePrice) !== p.basePrice;
      const moqChanged = Number(e.moq) !== p.moq;
      if (!priceChanged && !moqChanged) continue;
      const price = Number(e.basePrice);
      const moq = Number(e.moq);
      if (!Number.isFinite(price) || price <= 0) {
        toast.error(`"${p.name}": price must be greater than 0.`);
        return;
      }
      if (!Number.isFinite(moq) || moq < 1 || !Number.isInteger(moq)) {
        toast.error(`"${p.name}": MOQ must be a whole number ≥ 1.`);
        return;
      }
    }
    setSaving(true);
    let okCount = 0;
    let failCount = 0;
    let firstConflict = '';
    for (const p of products) {
      const e = edits[p.id];
      if (!e) continue;
      const price = Number(e.basePrice);
      const moq = Number(e.moq);
      const priceChanged = price !== p.basePrice;
      const moqChanged = moq !== p.moq;
      if (!priceChanged && !moqChanged) continue;
      try {
        const res = await fetch(`/api/supplier/products/${p.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(buildFullReplacePayload(p, price, moq)),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          okCount++;
          // Mirror the persisted values back into local state so the row is no longer dirty.
          setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, basePrice: price, moq } : x)));
        } else {
          failCount++;
          if (res.status === 409 && !firstConflict) {
            firstConflict = json?.error || `"${p.name}" has variants referenced by active carts or orders — price update blocked.`;
          }
        }
      } catch {
        failCount++;
      }
    }
    if (okCount > 0 && failCount === 0) {
      toast.success(`Saved ${okCount} ${okCount === 1 ? 'price' : 'prices'}`);
    } else if (okCount > 0 && failCount > 0) {
      toast.warning(`Saved ${okCount}, ${failCount} failed${firstConflict ? `: ${firstConflict}` : ''}`);
    } else if (failCount > 0) {
      toast.error(firstConflict || `All ${failCount} saves failed. Retry.`);
    }
    setSaving(false);
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <div className="p-2"><Skeleton className="w-5 h-5 rounded-full" /></div>
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-4 space-y-3">
          <Skeleton className="h-10 rounded-lg" />
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (state === 'auth' || state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Bulk Price Update</h1>
        </div>
        <div className="p-4 md:max-w-3xl md:mx-auto md:pt-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {state === 'auth' && (
                <button onClick={() => navigate('login')} className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium">
                  Sign in
                </button>
              )}
              <button onClick={load} className="min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Bulk Price Update</h1>
        </div>
        <button onClick={load} aria-label="Refresh" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="p-4 md:max-w-4xl md:mx-auto md:p-6 md:pt-8 space-y-4">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bulk Price Update</h1>
          <button onClick={load} className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-primary inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search products by name…"
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
          />
        </div>

        {products.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No products found</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {search ? 'No products match your search.' : 'You have no products yet. Create one in the seller console.'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <div className="col-span-6">Product</div>
                <div className="col-span-2 text-right">Price (৳)</div>
                <div className="col-span-2 text-right">MOQ</div>
                <div className="col-span-2 text-right">Stock</div>
              </div>

              {products.map((p) => {
                const e = edits[p.id] ?? { basePrice: String(p.basePrice), moq: String(p.moq) };
                const priceChanged = Number(e.basePrice) !== p.basePrice;
                const moqChanged = Number(e.moq) !== p.moq;
                const dirty = priceChanged || moqChanged;
                return (
                  <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 items-center">
                    <div className="col-span-12 md:col-span-6 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{p.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate">
                        {p.sku || 'no SKU'} · {p.category?.name || 'Uncategorized'} · {p.unit}
                      </div>
                    </div>
                    <div className="col-span-6 md:col-span-2 flex items-center justify-end gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={e.basePrice}
                        onChange={(ev) => updateEdit(p.id, 'basePrice', ev.target.value)}
                        className={`w-24 px-2 py-1.5 bg-gray-50 dark:bg-gray-950 border rounded text-sm text-right text-gray-900 dark:text-gray-100 focus:outline-none ${priceChanged ? 'border-primary' : 'border-gray-200 dark:border-gray-800 focus:border-primary'}`}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 flex items-center justify-end gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="1"
                        value={e.moq}
                        onChange={(ev) => updateEdit(p.id, 'moq', ev.target.value)}
                        className={`w-20 px-2 py-1.5 bg-gray-50 dark:bg-gray-950 border rounded text-sm text-right text-gray-900 dark:text-gray-100 focus:outline-none ${moqChanged ? 'border-primary' : 'border-gray-200 dark:border-gray-800 focus:border-primary'}`}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-2 text-right text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
                      {money(p.stockQuantity)} {p.unit}
                      {dirty && <span className="ml-1 text-xs text-primary">·edited</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {(totalPages > 1 || total > 0) && (
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                <span>
                  Page {page} of {Math.max(1, totalPages)} · {total} product{total === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={saveAll}
              disabled={saving || dirtyCount === 0}
              className="w-full bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving…' : dirtyCount === 0 ? 'No changes to save' : `Save All (${dirtyCount})`}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center">
              Each save writes the full product back. A product referenced by active carts or orders may be blocked (409) — hide the listing instead.
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default BulkPriceUpdatePage;
