'use client';

/**
 * Inventory Restock Intake (Task 175-b) — REAL hydration + REAL save.
 *
 * The previous page rendered an uncontrolled intake form (PO Number, Supplier
 * Source, Quantity, Batch Expiry) with a "Process Intake" button that had NO
 * onClick. The real rails:
 *   GET   /api/supplier/inventory — lists the supplier's REAL stock levels
 *         (products + variants) so the seller can choose what to restock.
 *   PATCH /api/supplier/inventory — accepts { updates: [{ productId?, variantId?,
 *         newQuantity? | delta?, stockAlertThreshold? }] }. A positive `delta`
 *         is the canonical restock — server-side it notifies back-in-stock
 *         watchers, broadcasts `inventory:updated`, and writes an audit log.
 *
 * This page now:
 *   - loads the real inventory via GET /api/supplier/inventory,
 *   - lets the seller pick a real product (or one of its variants) and enter
 *     a quantity received,
 *   - submits via PATCH with `delta: +qty` (the canonical restock writer),
 *   - honestly notes that PO Number, Supplier Source, and Batch Expiry are
 *     drafts — they are NOT persisted yet (the inventory schema has no
 *     column for them; the rail accepts only quantity + threshold). They
 *     are shown with an amber notice and disabled persistence — never
 *     silently dropped and never faked as saved.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RefreshCw, AlertTriangle, Package, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface InvVariant {
  id: string;
  variantName: string;
  variantValue: string;
  sku: string | null;
  stockQuantity: number;
  priceOverride: number | null;
}
interface InvItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  stockQuantity: number;
  moq: number;
  thumbnailUrl: string | null;
  isActive: boolean;
  isApproved: boolean;
  stockAlertThreshold: number | null;
  category: { name: string } | null;
  variants: InvVariant[];
}

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export function InventoryRestockPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [items, setItems] = useState<InvItem[]>([]);
  const [search, setSearch] = useState('');

  // form state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [supplierSource, setSupplierSource] = useState('');
  const [batchExpiry, setBatchExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('Sign in as a supplier to restock inventory.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const res = await fetch('/api/supplier/inventory', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'Inventory management is not available on this account.');
        return;
      }
      if (!res.ok || !json?.success || !json?.data) {
        setState('error');
        setLoadError(json?.error || `Failed to load inventory (HTTP ${res.status})`);
        return;
      }
      setItems((json.data.items ?? []) as InvItem[]);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading inventory. Check your connection and retry.');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q));
  }, [items, search]);

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedProductId) || null, [items, selectedProductId]);
  const selectedVariant = useMemo(
    () => selectedItem?.variants.find((v) => v.id === selectedVariantId) || null,
    [selectedItem, selectedVariantId]
  );

  const currentStock = selectedVariant ? selectedVariant.stockQuantity : selectedItem?.stockQuantity ?? 0;
  const qtyNum = Number(quantity);
  const qtyValid = quantity !== '' && Number.isFinite(qtyNum) && qtyNum > 0;

  const submit = async () => {
    if (saving) return;
    if (!selectedProductId) { toast.error('Pick a product to restock.'); return; }
    if (selectedItem && selectedItem.variants.length > 0 && !selectedVariantId) {
      toast.error('This product has variants — pick which one to restock.');
      return;
    }
    if (!qtyValid) { toast.error('Quantity received must be a number greater than 0.'); return; }
    setSaving(true);
    try {
      const update: Record<string, unknown> = { delta: qtyNum };
      if (selectedVariantId) update.variantId = selectedVariantId;
      else update.productId = selectedProductId;
      const res = await fetch('/api/supplier/inventory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ updates: [update] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Restock failed (HTTP ${res.status})`);
        return;
      }
      toast.success(json.message || `Restocked +${qtyNum} ${selectedItem?.unit || 'units'}`);
      // Reset the form
      setQuantity('');
      setPoNumber('');
      setSupplierSource('');
      setBatchExpiry('');
      void load();
    } catch {
      toast.error('Network error while restocking. Retry.');
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
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
    );
  }

  if (state === 'auth' || state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Restock Intake</h1>
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
              <button onClick={load} className="min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-2">
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
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Restock Intake</h1>
        </div>
        <button onClick={load} aria-label="Refresh" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="p-4 md:max-w-3xl md:mx-auto md:p-6 md:pt-8 space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Restock Intake</h1>
          <button onClick={load} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Honest notice about draft-only fields */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            The restock rail writes the <strong>quantity received</strong> to real stock (and triggers back-in-stock
            notifications). <strong>PO Number, Supplier Source, and Batch Expiry</strong> are draft metadata — the
            inventory schema has no columns for them yet, so they are not persisted. Process Intake only stores the
            quantity delta.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-2">
            <Package className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No products in inventory</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Create a product first to restock it.</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Pick a product to restock</h2>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                {filteredItems.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500 dark:text-gray-400 text-center">No products match your search.</div>
                ) : (
                  filteredItems.map((i) => {
                    const isSel = selectedProductId === i.id;
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => { setSelectedProductId(i.id); setSelectedVariantId(''); }}
                        className={`w-full text-left p-3 flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-950 ${isSel ? 'bg-red-50 dark:bg-red-950/30' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{i.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {i.sku || 'no SKU'} · stock: {money(i.stockQuantity)} {i.unit}
                            {i.variants.length > 0 && ` · ${i.variants.length} variant${i.variants.length === 1 ? '' : 's'}`}
                          </div>
                        </div>
                        {isSel && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedItem && selectedItem.variants.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Variant</label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                  >
                    <option value="">— Pick a variant —</option>
                    {selectedItem.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.variantName}: {v.variantValue} · stock: {money(v.stockQuantity)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedItem && (
                <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
                  Selected: <span className="font-medium text-gray-900 dark:text-gray-100">{selectedItem.name}</span>
                  {selectedVariant && (
                    <span> · {selectedVariant.variantName}: {selectedVariant.variantValue}</span>
                  )}
                  <br />
                  Current stock: <span className="font-medium text-gray-900 dark:text-gray-100">{money(currentStock)} {selectedItem.unit}</span>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Intake details</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantity received *</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                    placeholder="e.g. 100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Added to current stock as a delta (+).</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Batch expiry <span className="text-xs text-gray-400">(draft — not persisted)</span></label>
                  <input
                    type="date"
                    value={batchExpiry}
                    onChange={(e) => setBatchExpiry(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-500 dark:text-gray-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">PO Number <span className="text-xs text-gray-400">(draft — not persisted)</span></label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="PO-10024"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-500 dark:text-gray-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier source <span className="text-xs text-gray-400">(draft — not persisted)</span></label>
                  <input
                    type="text"
                    value={supplierSource}
                    onChange={(e) => setSupplierSource(e.target.value)}
                    placeholder="Supplier name"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-500 dark:text-gray-400"
                  />
                </div>
              </div>

              <button
                onClick={submit}
                disabled={saving || !selectedProductId || !qtyValid || (selectedItem?.variants.length ?? 0) > 0 && !selectedVariantId}
                className="w-full bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Processing…' : 'Process Intake'}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                The rail writes the quantity delta to stock and notifies back-in-stock watchers.
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default InventoryRestockPage;
