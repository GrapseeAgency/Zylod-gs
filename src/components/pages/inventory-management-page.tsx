'use client';

/**
 * Inventory management (Task 50-a) — consumes the REAL GET /api/supplier/inventory
 * shape (products with nested variants; the old page read data.items of a
 * payload that never existed and expected {sku,title,stock,location}), and
 * quick-adjust actually works now: PATCH {updates:[{productId|variantId, delta|
 * newQuantity}]} with ownership verified server-side. Optimistic updates roll
 * back on failure — success is never faked.
 *
 * Task 79: every low-stock judgment here honors the SELLER-TUNED
 * products.stockAlertThreshold (inline "Alert at" editor per row; null falls
 * back to the platform default). The old hardcoded ≤20 is gone.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, AlertTriangle, Box, Package, RefreshCw, Plus, Minus,
  ChevronDown, ChevronRight, CheckCircle2, LogIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { useRealtimeRoom, type RealtimeRoomMessage } from '@/hooks/use-realtime-room';

interface ApiVariant {
  id: string;
  variantName: string;
  variantValue: string;
  sku: string | null;
  stockQuantity: number;
  priceOverride: number | null;
}

interface ApiInventoryProduct {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  stockQuantity: number;
  moq: number;
  thumbnailUrl: string | null;
  isActive: boolean;
  isApproved: boolean;
  updatedAt: string;
  stockAlertThreshold: number | null;
  category: { name: string } | null;
  variants: ApiVariant[];
}

interface ApiSummary {
  totalSkus: number;
  totalVariantSkus: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryUnits: number;
}

/** Platform default for products whose seller never tuned their alert line. */
const LOW_STOCK_FALLBACK = 20;

/** The low-stock line for a product: seller-tuned threshold, else default. */
function alertLineFor(p: Pick<ApiInventoryProduct, 'stockAlertThreshold'>): number {
  return p.stockAlertThreshold ?? LOW_STOCK_FALLBACK;
}

function isLowStock(p: Pick<ApiInventoryProduct, 'stockQuantity' | 'stockAlertThreshold'>): boolean {
  return p.stockQuantity > 0 && p.stockQuantity <= alertLineFor(p);
}

function StockChip({ quantity, unit, alertLine }: { quantity: number; unit?: string; alertLine?: number }) {
  if (quantity <= 0) {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
        Out of stock
      </span>
    );
  }
  if (alertLine !== undefined && quantity <= alertLine) {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
        Low · {quantity} {unit}
      </span>
    );
  }
  if (alertLine === undefined && quantity <= LOW_STOCK_FALLBACK) {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
        Low · {quantity} {unit}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
      In stock · {quantity} {unit}
    </span>
  );
}

export function InventoryManagementPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [items, setItems] = useState<ApiInventoryProduct[]>([]);
  const [summary, setSummary] = useState<ApiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // per-target single-flight + set-to-value inputs
  const [actingKey, setActingKey] = useState('');
  const [setValueInputs, setSetValueInputs] = useState<Record<string, string>>({});
  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({});
  const seqRef = useRef(0);

  const fetchInventory = useCallback(async (background = false) => {
    const seq = ++seqRef.current;
    if (background) setRefreshing(true);
    else {
      setLoading(true);
      setError('');
    }
    try {
      const res = await fetch('/api/supplier/inventory', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      if (seq !== seqRef.current) return;
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true);
        setItems([]);
        setSummary(null);
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message = json?.error || `Failed to load inventory (HTTP ${res.status})`;
        setError(message);
        return;
      }
      setItems(Array.isArray(json.data?.items) ? json.data.items : []);
      setSummary(json.data?.summary ?? null);
      setNeedsAuth(false);
    } catch {
      if (seq !== seqRef.current) return;
      setError('Network error while loading inventory. Check your connection and retry.');
    } finally {
      if (seq === seqRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // ─── Real-time (Task 51-a): live-apply cross-session stock truth ───
  // Product rooms are PUBLIC (no token). The socket service allows 10
  // subscribes/min per socket, so the hook (and this list) caps at 8 rooms —
  // rows beyond that still stay fresh through the Refresh button / refetch.
  // Only real event payload fields are applied; the rollback-safe optimistic
  // pattern below is untouched (this handler is a separate truth channel).
  const liveRooms = useMemo(
    () => items.slice(0, 8).map((p) => `product:${p.id}`),
    [items]
  );

  const handleLiveInventory = useCallback((msg: RealtimeRoomMessage) => {
    if (msg.event !== 'inventory:updated') return;
    const d = msg.data as Record<string, unknown> | null;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return;
    if (typeof d.productId !== 'string' || d.productId.length === 0) return;
    const stock = d.stockQuantity;
    if (typeof stock !== 'number' || !Number.isFinite(stock) || stock < 0) return;
    const variantId = typeof d.variantId === 'string' && d.variantId.length > 0 ? d.variantId : null;
    // Task 79: a threshold change rides the same cross-session event.
    const thresholdTouched = 'stockAlertThreshold' in d;
    const threshold = thresholdTouched && (d.stockAlertThreshold === null || typeof d.stockAlertThreshold === 'number')
      ? (d.stockAlertThreshold as number | null)
      : undefined;
    setItems((prev) =>
      variantId
        ? prev.map((p) =>
            p.id === d.productId
              ? { ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, stockQuantity: stock } : v)) }
              : p
          )
        : prev.map((p) =>
            p.id === d.productId
              ? { ...p, stockQuantity: stock, ...(threshold !== undefined ? { stockAlertThreshold: threshold } : {}) }
              : p
          )
    );
  }, []);

  useRealtimeRoom(needsAuth ? [] : liveRooms, { onEvent: handleLiveInventory });

  // Keep the summary chips consistent with the rows they summarize while live
  // events mutate stock (formula mirrors GET /api/supplier/inventory exactly,
  // including the per-product alert line).
  useEffect(() => {
    setSummary({
      totalSkus: items.length,
      totalVariantSkus: items.reduce((acc, p) => acc + p.variants.length, 0),
      lowStockCount: items.filter(isLowStock).length,
      outOfStockCount: items.filter((p) => p.stockQuantity <= 0).length,
      totalInventoryUnits: items.reduce((acc, p) => acc + p.stockQuantity, 0),
    });
  }, [items]);

  /**
   * One real PATCH per adjust. Optimistic local update is applied immediately
   * and ROLLED BACK from the server's before/after response on failure — the
   * UI never invents a successful state.
   */
  const applyStockUpdate = async (
    target: { productId: string } | { variantId: string },
    change: { delta?: number; newQuantity?: number }
  ) => {
    const key = 'productId' in target ? `p:${target.productId}` : `v:${target.variantId}`;
    if (actingKey) return; // one flight at a time per page (simple + honest)
    setActingKey(key);

    const findQuantity = (list: ApiInventoryProduct[]): number | null => {
      if ('productId' in target) {
        return list.find((p) => p.id === target.productId)?.stockQuantity ?? null;
      }
      for (const p of list) {
        const v = p.variants.find((x) => x.id === target.variantId);
        if (v) return v.stockQuantity;
      }
      return null;
    };
    const before = findQuantity(items);
    if (before === null) return;

    // Optimistic write
    const optimistic = (list: ApiInventoryProduct[]): ApiInventoryProduct[] =>
      change.newQuantity !== undefined
        ? list.map((p) => {
            if ('productId' in target) return p.id === target.productId ? { ...p, stockQuantity: change.newQuantity! } : p;
            return { ...p, variants: p.variants.map((v) => (v.id === target.variantId ? { ...v, stockQuantity: change.newQuantity! } : v)) };
          })
        : list.map((p) => {
            if ('productId' in target) return p.id === target.productId ? { ...p, stockQuantity: Math.max(0, p.stockQuantity + (change.delta ?? 0)) } : p;
            return { ...p, variants: p.variants.map((v) => (v.id === target.variantId ? { ...v, stockQuantity: Math.max(0, v.stockQuantity + (change.delta ?? 0)) } : v)) };
          });
    setItems(optimistic);

    try {
      const res = await fetch('/api/supplier/inventory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ updates: [{ ...target, ...change }] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        // Rollback to the REAL pre-change value, surface the verbatim error.
        setItems((current) =>
          current.map((p) => {
            if ('productId' in target && p.id === target.productId) return { ...p, stockQuantity: before };
            if ('variantId' in target) {
              return { ...p, variants: p.variants.map((v) => (v.id === target.variantId ? { ...v, stockQuantity: before } : v)) };
            }
            return p;
          })
        );
        const message = json?.error || `Stock update failed (HTTP ${res.status})`;
        toast.error(message);
        return;
      }
      // Apply the server's real before/after rows (source of truth).
      const applied = Array.isArray(json.data?.results) ? json.data.results[0] : null;
      if (applied) {
        const after = applied.after as number | undefined;
        const thresholdAfter = applied.thresholdAfter as number | null | undefined;
        setItems((current) =>
          current.map((p) => {
            if ('productId' in applied && p.id === applied.productId) {
              return {
                ...p,
                ...(typeof after === 'number' ? { stockQuantity: after } : {}),
                ...(thresholdAfter !== undefined ? { stockAlertThreshold: thresholdAfter } : {}),
              };
            }
            if ('variantId' in applied) {
              return { ...p, variants: p.variants.map((v) => (v.id === applied.variantId ? { ...v, stockQuantity: after ?? v.stockQuantity } : v)) };
            }
            return p;
          })
        );
      }
    } catch {
      setItems((current) =>
        current.map((p) => {
          if ('productId' in target && p.id === target.productId) return { ...p, stockQuantity: before };
          if ('variantId' in target) {
            return { ...p, variants: p.variants.map((v) => (v.id === target.variantId ? { ...v, stockQuantity: before } : v)) };
          }
          return p;
        })
      );
      toast.error('Network error — stock change was not saved.');
    } finally {
      setActingKey('');
    }
  };

  const submitSetValue = (target: { productId: string } | { variantId: string }) => {
    const key = 'productId' in target ? `p:${target.productId}` : `v:${target.variantId}`;
    const raw = (setValueInputs[key] ?? '').trim();
    if (raw === '') return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      toast.error('Enter a whole number ≥ 0.');
      return;
    }
    applyStockUpdate(target, { newQuantity: n });
    setSetValueInputs((prev) => ({ ...prev, [key]: '' }));
  };

  /**
   * Task 79: the seller-tuned low-stock line, saved through the SAME audited
   * PATCH (stockAlertThreshold on the product update). The response's real
   * thresholdAfter is applied — no optimistic guess needed here.
   */
  const submitThresholdValue = async (productId: string, value: number | null) => {
    const key = `p:${productId}`;
    if (actingKey) return;
    setActingKey(key);
    try {
      const res = await fetch('/api/supplier/inventory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ updates: [{ productId, stockAlertThreshold: value }] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Alert update failed (HTTP ${res.status})`);
        return;
      }
      const applied = Array.isArray(json.data?.results) ? json.data.results[0] : null;
      const thresholdAfter = applied?.thresholdAfter;
      if (thresholdAfter !== undefined) {
        setItems((current) =>
          current.map((p) => (p.id === productId ? { ...p, stockAlertThreshold: thresholdAfter as number | null } : p))
        );
      }
      toast.success(json.message || 'Low-stock alert updated.');
    } catch {
      toast.error('Network error — alert threshold was not saved.');
    } finally {
      setActingKey('');
    }
  };

  const submitThreshold = (productId: string) => {
    const raw = (thresholdInputs[`p:${productId}`] ?? '').trim();
    if (raw === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Alert threshold must be a number ≥ 0.');
      return;
    }
    submitThresholdValue(productId, n);
    setThresholdInputs((prev) => ({ ...prev, [`p:${productId}`]: '' }));
  };

  const totalUnits = summary?.totalInventoryUnits ?? items.reduce((acc, p) => acc + p.stockQuantity, 0);
  const lowStock = summary?.lowStockCount ?? items.filter(isLowStock).length;
  const outOfStock = summary?.outOfStockCount ?? items.filter((p) => p.stockQuantity <= 0).length;
  const customAlerts = items.filter((p) => p.stockAlertThreshold != null).length;

  if (needsAuth) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Inventory Management</h1>
        </div>
        <div className="p-4 max-w-3xl mx-auto md:p-6 md:pt-10">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
            <LogIn className="w-8 h-8 text-gray-400 dark:text-gray-500 dark:text-gray-400 mx-auto" />
            <p className="text-sm text-gray-700 dark:text-gray-300">Sign in as a supplier to manage your inventory.</p>
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
      className="overflow-x-hidden min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8"
    >
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Inventory Management</h1>
        </div>
      </div>

      <div className="p-4 md:max-w-5xl md:mx-auto md:p-6 md:pb-8">
        <div className="hidden md:flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventory Management</h1>
          <button
            onClick={() => fetchInventory(true)}
            disabled={refreshing}
            className="min-h-11 px-4 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700">
              {error}
              <button onClick={() => fetchInventory()} className="block mt-1 underline font-medium">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Real summary chips from the API (products; variant SKUs counted separately) */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <div className="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-2">
              <Package className="w-4 h-4" />
              <span className="text-xs font-medium">Total SKUs</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{summary?.totalSkus ?? items.length}</p>
            {summary && summary.totalVariantSkus > 0 && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">+{summary.totalVariantSkus} variant SKUs</p>
            )}
          </div>
          <div className="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-2">
              <Box className="w-4 h-4" />
              <span className="text-xs font-medium">Total Units</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{totalUnits}</p>
          </div>
          <div className="bg-amber-50 p-3 md:p-4 rounded-xl border border-amber-100 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium" title={customAlerts > 0 ? `${customAlerts} of ${items.length} products use a custom alert line` : 'Using the platform default alert line (≤20)'}>
                Low stock{customAlerts > 0 ? ` · ${customAlerts} custom` : ' (≤20 default)'}
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-amber-700">{lowStock}</p>
          </div>
          <div className="bg-red-50 p-3 md:p-4 rounded-xl border border-red-100 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <RefreshCw className="w-4 h-4" />
              <span className="text-xs font-medium">Out of Stock</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-red-700">{outOfStock}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mt-4 md:mt-6">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Stock Levels</h2>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400">Quick edits apply instantly to your real stock</span>
          </div>

          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No inventory yet</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                  Your stock levels appear here once you create products. Publish your first listing to get started.
                </p>
                <button
                  onClick={() => navigate('seller-add-product')}
                  className="mt-4 min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium"
                >
                  Add a product
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((product) => {
                  const key = `p:${product.id}`;
                  const isExpanded = expanded[product.id] ?? false;
                  return (
                    <li key={product.id}>
                      {/* Product row */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Hide variants' : 'Show variants'}
                              onClick={() => setExpanded((prev) => ({ ...prev, [product.id]: !isExpanded }))}
                              disabled={product.variants.length === 0}
                              className="min-h-11 min-w-8 flex items-center justify-center text-gray-500 dark:text-gray-400 dark:text-gray-500 disabled:opacity-0"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm line-clamp-1">{product.name}</h3>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
                                {product.category?.name ?? 'Uncategorized'}
                                {product.sku ? ` · SKU ${product.sku}` : ''}
                                {product.variants.length > 0 ? ` · ${product.variants.length} variant${product.variants.length === 1 ? '' : 's'}` : ''}
                              </p>
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                <StockChip quantity={product.stockQuantity} unit={product.unit} alertLine={alertLineFor(product)} />
                                {product.stockAlertThreshold != null && (
                                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100" title="This product uses its own low-stock alert line">
                                    Alert at ≤{product.stockAlertThreshold} {product.unit}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className={`text-lg font-bold ${product.stockQuantity === 0 ? 'text-red-500' : isLowStock(product) ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'}`}>
                              {product.stockQuantity}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={`Decrease stock of ${product.name} by 1`}
                                disabled={actingKey === key}
                                onClick={() => applyStockUpdate({ productId: product.id }, { delta: -1 })}
                                className="min-h-11 min-w-11 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center"
                              >
                                <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Increase stock of ${product.name} by 1`}
                                disabled={actingKey === key}
                                onClick={() => applyStockUpdate({ productId: product.id }, { delta: 1 })}
                                className="min-h-11 min-w-11 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center"
                              >
                                <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-3 pl-0 sm:pl-11">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            aria-label={`Set stock of ${product.name} to an exact value`}
                            placeholder="Set to value…"
                            value={setValueInputs[key] ?? ''}
                            onChange={(e) => setSetValueInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="min-h-11 w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <button
                            type="button"
                            disabled={actingKey === key || (setValueInputs[key] ?? '').trim() === ''}
                            onClick={() => submitSetValue({ productId: product.id })}
                            className="min-h-11 px-4 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            Set
                          </button>
                          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:ml-1">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              aria-label={`Low-stock alert threshold for ${product.name} (empty = platform default ${LOW_STOCK_FALLBACK})`}
                              placeholder={`Alert at… (default ${LOW_STOCK_FALLBACK})`}
                              value={thresholdInputs[key] ?? ''}
                              onChange={(e) => setThresholdInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') submitThreshold(product.id);
                              }}
                              className="min-h-11 w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <button
                              type="button"
                              disabled={actingKey === key || (thresholdInputs[key] ?? '').trim() === ''}
                              onClick={() => submitThreshold(product.id)}
                              className="min-h-11 px-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 disabled:opacity-50"
                            >
                              Alert
                            </button>
                            {product.stockAlertThreshold != null && (
                              <button
                                type="button"
                                aria-label={`Reset ${product.name} to the platform default alert line (${LOW_STOCK_FALLBACK})`}
                                disabled={actingKey === key}
                                onClick={() => submitThresholdValue(product.id, null)}
                                className="min-h-11 px-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 dark:text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 disabled:opacity-50"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          {actingKey === key && <RefreshCw className="w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400 animate-spin" aria-label="Saving" />}
                        </div>
                      </div>

                      {/* Variant rows (real nested variants) */}
                      {isExpanded && product.variants.length === 0 && (
                        <p className="px-4 pb-4 pl-14 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">This product has no variants.</p>
                      )}
                      {isExpanded &&
                        product.variants.map((variant) => {
                          const vKey = `v:${variant.id}`;
                          return (
                            <div key={variant.id} className="px-4 pb-4 pl-11 sm:pl-14">
                              <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                      {variant.variantName}: {variant.variantValue}
                                    </p>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
                                      {variant.sku ? `SKU ${variant.sku} · ` : ''}
                                      {variant.priceOverride != null ? `Price override ${variant.priceOverride} BDT` : 'Base price applies'}
                                    </p>
                                    <div className="mt-1.5">
                                      <StockChip quantity={variant.stockQuantity} unit={product.unit} alertLine={alertLineFor(product)} />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      aria-label={`Decrease stock of ${variant.variantValue} by 1`}
                                      disabled={actingKey === vKey}
                                      onClick={() => applyStockUpdate({ variantId: variant.id }, { delta: -1 })}
                                      className="min-h-11 min-w-11 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center"
                                    >
                                      <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Increase stock of ${variant.variantValue} by 1`}
                                      disabled={actingKey === vKey}
                                      onClick={() => applyStockUpdate({ variantId: variant.id }, { delta: 1 })}
                                      className="min-h-11 min-w-11 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center"
                                    >
                                      <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    inputMode="numeric"
                                    aria-label={`Set stock of ${variant.variantValue} to an exact value`}
                                    placeholder="Set to value…"
                                    value={setValueInputs[vKey] ?? ''}
                                    onChange={(e) => setSetValueInputs((prev) => ({ ...prev, [vKey]: e.target.value }))}
                                    className="min-h-11 w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                  <button
                                    type="button"
                                    disabled={actingKey === vKey || (setValueInputs[vKey] ?? '').trim() === ''}
                                    onClick={() => submitSetValue({ variantId: variant.id })}
                                    className="min-h-11 px-4 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                  >
                                    Set
                                  </button>
                                  {actingKey === vKey && <RefreshCw className="w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400 animate-spin" aria-label="Saving" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button onClick={() => navigate('inventory-restock')} className="min-h-11 py-3 px-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 text-center hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800">
            Restock planning
          </button>
          <button onClick={() => navigate('inventory-audit-log')} className="min-h-11 py-3 px-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 text-center hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800">
            Stock audit info
          </button>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-4">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Every quick edit above is verified against your own catalog server-side and written in one transaction. "Alert" sets this product's own low-stock line — variants inherit it, and the product page shows urgency once stock dips to it.
        </p>
      </div>
    </motion.div>
  );
}

export default InventoryManagementPage;
