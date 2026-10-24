'use client';

/**
 * Inventory Alerts (Task 175-b) — REAL hydration + REAL save.
 *
 * The previous page rendered a hardcoded "Low Stock Threshold = 20" with a
 * decorative auto-pause toggle and a "Save Rules" button that had NO onClick.
 *
 * The real rails:
 *   GET   /api/seller/stock-watches — read-only demand signal: for every
 *         product this supplier owns, how many buyers currently hold an
 *         ACTIVE back-in-stock watch on it. Zero-watch products are not rows.
 *   GET   /api/supplier/inventory   — the supplier's real stock levels +
 *         stockAlertThreshold (the seller-tuned low-stock line, null = fall
 *         back to the platform default of 20).
 *   PATCH /api/supplier/inventory   — accepts { updates: [{ productId,
 *         stockAlertThreshold }] }. A threshold-only touch is the canonical
 *         "low-stock line" writer.
 *
 * This page now:
 *   - loads the real demand list via GET /api/seller/stock-watches,
 *   - loads the real inventory via GET /api/supplier/inventory,
 *   - lets the seller tune a low-stock threshold per product,
 *   - on Save Rules, batches the threshold changes through PATCH (threshold-only
 *     touches — never a quantity change),
 *   - honestly disables the "Auto-pause listing" toggle (no rail has shipped
 *     that behavior — `products.isActive` is managed in the listings console,
 *     not by a stock-rule trigger).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RefreshCw, AlertTriangle, Bell, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface DemandRow {
  productId: string;
  productName: string;
  stockQuantity: number;
  unit: string;
  isActive: boolean;
  watchers: number;
}
interface InvItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  stockQuantity: number;
  moq: number;
  stockAlertThreshold: number | null;
  category: { name: string } | null;
  isActive: boolean;
  isApproved: boolean;
}

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

const LOW_STOCK_FALLBACK = 20;
const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export function InventoryAlertsPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [demand, setDemand] = useState<DemandRow[]>([]);
  const [items, setItems] = useState<InvItem[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('Sign in as a supplier to manage stock alerts.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const [invRes, demandRes] = await Promise.all([
        fetch('/api/supplier/inventory', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
        fetch('/api/seller/stock-watches', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
      ]);
      const invJson = await invRes.json().catch(() => null);
      const demandJson = await demandRes.json().catch(() => null);

      if (invRes.status === 401 || invRes.status === 403) {
        setState('auth');
        setLoadError(invJson?.error || 'Stock alert management is not available on this account.');
        return;
      }
      if (!invRes.ok || !invJson?.success || !invJson?.data) {
        setState('error');
        setLoadError(invJson?.error || `Failed to load inventory (HTTP ${invRes.status})`);
        return;
      }

      const invItems = (invJson.data.items ?? []) as InvItem[];
      setItems(invItems);
      const nextThresholds: Record<string, string> = {};
      for (const i of invItems) {
        nextThresholds[i.id] = i.stockAlertThreshold == null ? '' : String(i.stockAlertThreshold);
      }
      setThresholds(nextThresholds);

      // Demand rail is best-effort — a 403 here just means no demand list.
      if (demandRes.ok && demandJson?.success && Array.isArray(demandJson?.data)) {
        setDemand(demandJson.data as DemandRow[]);
      } else {
        setDemand([]);
      }
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading inventory. Check your connection and retry.');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const i of items) {
      const t = thresholds[i.id];
      if (t === undefined) continue;
      const trimmed = t.trim();
      const beforeNum = i.stockAlertThreshold;
      if (trimmed === '') {
        if (beforeNum !== null) n++;
      } else {
        const num = Number(trimmed);
        if (Number.isFinite(num) && num !== beforeNum) n++;
      }
    }
    return n;
  }, [items, thresholds]);

  const updateThreshold = (id: string, value: string) => {
    setThresholds((prev) => ({ ...prev, [id]: value }));
  };

  const saveRules = async () => {
    if (saving || dirtyCount === 0) return;
    // Validate
    const updates: Array<{ productId: string; stockAlertThreshold: number | null }> = [];
    for (const i of items) {
      const t = thresholds[i.id];
      if (t === undefined) continue;
      const trimmed = t.trim();
      const beforeNum = i.stockAlertThreshold;
      if (trimmed === '') {
        if (beforeNum !== null) updates.push({ productId: i.id, stockAlertThreshold: null });
      } else {
        const num = Number(trimmed);
        if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
          toast.error(`"${i.name}": threshold must be a whole number ≥ 0 (or empty for default).`);
          return;
        }
        if (num !== beforeNum) updates.push({ productId: i.id, stockAlertThreshold: num });
      }
    }
    if (updates.length === 0) {
      toast.info('No changes to save.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/supplier/inventory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ updates }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Save failed (HTTP ${res.status})`);
        return;
      }
      toast.success(json.message || `Updated low-stock threshold for ${updates.length} ${updates.length === 1 ? 'item' : 'items'}`);
      void load();
    } catch {
      toast.error('Network error while saving. Retry.');
    } finally {
      setSaving(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <div className="p-2"><Skeleton className="w-5 h-5 rounded-full" /></div>
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-4 space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Stock Alerts</h1>
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Stock Alerts</h1>
        </div>
        <button onClick={load} aria-label="Refresh" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="p-4 md:max-w-3xl md:mx-auto md:p-6 md:pt-8 space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Alerts</h1>
          <button onClick={load} className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-primary inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Demand queue: real buyers waiting on restock */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Restock demand
          </h2>
          {demand.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              No active back-in-stock watches on your products right now. Buyers who press “Notify me when available” on an out-of-stock listing will appear here.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {demand.length} product{demand.length === 1 ? '' : 's'} {demand.length === 1 ? 'has' : 'have'} active back-in-stock watchers — prioritize these for restock.
              </p>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {demand.map((d) => (
                  <div key={d.productId} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{d.productName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        Stock: {money(d.stockQuantity)} {d.unit} · {!d.isActive && 'inactive · '}
                        <span className="text-primary font-medium">{d.watchers} watcher{d.watchers === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Threshold rules: real per-product low-stock line */}
        <div className="bg-white dark:bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <Bell className="w-5 h-5" />
            <h2 className="font-semibold md:text-lg text-gray-900 dark:text-gray-100">Low-stock thresholds</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Each product's low-stock line is tuned separately. Leave a field empty to fall back to the platform default of <strong>{LOW_STOCK_FALLBACK}</strong>. The threshold is informational — it drives the low-stock summary in your inventory dashboard, not an automated action.
          </p>

          {items.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No products in inventory</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Create a product to tune its low-stock line.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((i) => {
                const t = thresholds[i.id] ?? '';
                const effective = t.trim() === '' ? LOW_STOCK_FALLBACK : Number(t);
                const isLow = i.stockQuantity > 0 && i.stockQuantity <= effective;
                const isOut = i.stockQuantity <= 0;
                const beforeNum = i.stockAlertThreshold;
                const dirty = (t.trim() === '' ? beforeNum !== null : Number.isFinite(Number(t)) && Number(t) !== beforeNum);
                return (
              <div key={i.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{i.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    {i.sku || 'no SKU'} · stock: {money(i.stockQuantity)} {i.unit}
                    {isOut && <span className="ml-2 text-red-600 dark:text-red-400 font-medium">Out of stock</span>}
                    {!isOut && isLow && <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">Low</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={t}
                    onChange={(e) => updateThreshold(i.id, e.target.value)}
                    placeholder={String(LOW_STOCK_FALLBACK)}
                    className={`w-20 px-2 py-1.5 bg-gray-50 dark:bg-gray-950 border rounded text-sm text-center text-gray-900 dark:text-gray-100 focus:outline-none ${dirty ? 'border-primary' : 'border-gray-200 dark:border-gray-800 focus:border-primary'}`}
                  />
                  {dirty && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
              </div>
            );
          })}
            </div>
          )}

          {/* Auto-pause toggle: honestly disabled (no rail) */}
          <div className="bg-gray-50 dark:bg-gray-950 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-gray-700 dark:text-gray-300">
              <p className="font-medium">Auto-pause listing when stock hits zero — not available yet.</p>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
                The inventory rail does not auto-flip <code className="text-xs">products.isActive</code>. Hide a listing manually from the listings console, or restock to keep it live.
              </p>
            </div>
          </div>

          <button
            onClick={saveRules}
            disabled={saving || dirtyCount === 0}
            className="w-full bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving…' : dirtyCount === 0 ? 'No changes to save' : `Save Rules (${dirtyCount})`}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default InventoryAlertsPage;
