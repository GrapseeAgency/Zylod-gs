'use client';

/**
 * Product pricing tiers (Task 175-a) — REAL hydration + REAL chart + REAL save.
 *
 * The previous page rendered a literal gray rectangle labeled "Discount
 * Curve Chart Area" and the Apply Rules button had no onClick. The real
 * rail at GET /api/supplier/products/[id] returns the product's real
 * productPriceTiers rows ({ minQty, maxQty?, pricePerUnit }) plus basePrice.
 * The chart is now a REAL visual representation: one bar per tier, height
 * proportional to pricePerUnit against the basePrice reference line. On
 * save, the page rebuilds the full canonical payload and PATCHes
 * /api/supplier/products/[id] with the edited tiers (the canonical writer).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Save, Plus, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';

interface ApiTier {
  id: string;
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
}
interface ApiVariant {
  id: string;
  variantName: string;
  variantValue: string;
  sku: string | null;
  stockQuantity: number;
  priceOverride: number | null;
}
interface ApiImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}
interface ApiVideo {
  id: string;
  videoUrl: string;
  title: string | null;
  sortOrder: number;
}
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
  stockQuantity: number;
  stockAlertThreshold: number | null;
  isCustomizable: boolean;
  thumbnailUrl: string | null;
  images: ApiImage[];
  videos: ApiVideo[];
  variants: ApiVariant[];
  priceTiers: ApiTier[];
}

interface TierRow {
  minQty: string;
  maxQty: string;
  pricePerUnit: string;
}

type LoadState = 'loading' | 'auth' | 'notfound' | 'error' | 'ready';

function toRows(tiers: ApiTier[]): TierRow[] {
  return tiers.map((t) => ({
    minQty: String(t.minQty),
    maxQty: t.maxQty == null ? '' : String(t.maxQty),
    pricePerUnit: String(t.pricePerUnit),
  }));
}

function buildFullReplacePayload(p: ApiProduct, tiers: TierRow[]) {
  return {
    name: p.name,
    categoryId: p.categoryId,
    description: p.description,
    ...(p.brand ? { brand: p.brand } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    unit: p.unit,
    bundleSize: p.bundleSize,
    weightKg: p.weightKg,
    moq: p.moq,
    maxOrderQty: p.maxOrderQty,
    basePrice: p.basePrice,
    currency: 'BDT' as const,
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
    priceTiers: tiers
      .filter((t) => t.minQty.trim() !== '' || t.pricePerUnit.trim() !== '')
      .map((t) => ({
        minQty: t.minQty.trim() === '' ? NaN : Number(t.minQty),
        ...(t.maxQty.trim() !== '' ? { maxQty: Number(t.maxQty) } : { maxQty: null }),
        pricePerUnit: t.pricePerUnit.trim() === '' ? NaN : Number(t.pricePerUnit),
      })),
  };
}

export function ProductPricingTiersPage() {
  const { goBack, navigate, pageParams } = useNavigationStore();
  const token = useAuthStore((s) => s.token);
  const productId = typeof pageParams?.productId === 'string' ? pageParams.productId : (typeof pageParams?.id === 'string' ? pageParams.id : '');

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setState('error');
      setLoadError('No product was selected. Open this page from a product listing.');
      return;
    }
    if (!token) {
      setState('auth');
      setLoadError('Sign in as the product owner to manage pricing tiers.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const res = await fetch(`/api/supplier/products/${productId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'Sign in as the product owner to manage pricing tiers.');
        return;
      }
      if (res.status === 404) {
        setState('notfound');
        setLoadError('Product not found — it may have been removed, or it belongs to another seller.');
        return;
      }
      if (!res.ok || !json?.success || !json?.data) {
        setState('error');
        setLoadError(json?.error || `Failed to load the product (HTTP ${res.status})`);
        return;
      }
      const p = json.data as ApiProduct;
      setProduct(p);
      setRows(toRows(p.priceTiers ?? []));
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading the product. Check your connection and retry.');
    }
  }, [productId, token]);

  const setRows = (next: TierRow[]) => setTiers(next);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const addTier = () => {
    setTiers((prev) => [...prev, { minQty: '', maxQty: '', pricePerUnit: '' }]);
  };
  const updateTier = (index: number, field: keyof TierRow, value: string) => {
    setTiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };
  const removeTier = (index: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const basePrice = product?.basePrice ?? 0;
  const chartData = tiers
    .map((t) => {
      const qty = Number(t.minQty);
      const price = Number(t.pricePerUnit);
      return {
        qty: Number.isFinite(qty) ? qty : 0,
        price: Number.isFinite(price) ? price : 0,
        maxQty: t.maxQty.trim() === '' ? null : Number(t.maxQty),
        raw: t,
      };
    })
    .filter((d) => d.qty > 0 && d.price > 0);
  const maxPrice = Math.max(basePrice, ...chartData.map((d) => d.price), 0.0001);

  const handleSave = async () => {
    if (saving || !product || !productId) return;
    // Validate before submit.
    const filled = tiers.filter((t) => t.minQty.trim() !== '' || t.pricePerUnit.trim() !== '');
    for (const t of filled) {
      if (t.minQty.trim() === '' || !Number.isFinite(Number(t.minQty)) || Number(t.minQty) <= 0) {
        toast.error('Every tier needs a minimum quantity greater than 0.');
        return;
      }
      if (t.pricePerUnit.trim() === '' || !Number.isFinite(Number(t.pricePerUnit)) || Number(t.pricePerUnit) <= 0) {
        toast.error('Every tier needs a price per unit greater than 0.');
        return;
      }
      if (Number(t.pricePerUnit) > basePrice) {
        toast.error(`Tier at ${t.minQty} units: tier price must be ≤ the base price (৳${basePrice}).`);
        return;
      }
      if (t.maxQty.trim() !== '' && (!Number.isFinite(Number(t.maxQty)) || Number(t.maxQty) < Number(t.minQty))) {
        toast.error(`Tier at ${t.minQty} units: max quantity must be ≥ min quantity.`);
        return;
      }
    }
    // Sort + overlap check (mirror the server superRefine).
    const sorted = [...filled].sort((a, b) => Number(a.minQty) - Number(b.minQty));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (Number(cur.minQty) <= Number(prev.minQty)) {
        toast.error('Tier minimum quantities must strictly increase.');
        return;
      }
      if (prev.maxQty.trim() !== '' && Number(cur.minQty) <= Number(prev.maxQty)) {
        toast.error(`Tier at ${cur.minQty} overlaps the tier ending at ${prev.maxQty}.`);
        return;
      }
      if (prev.maxQty.trim() === '' && i < sorted.length) {
        toast.error('Only the last tier may be open-ended (empty max quantity).');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = buildFullReplacePayload(product, tiers);
      const res = await fetch(`/api/supplier/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message =
          json?.error ||
          (res.status === 409
            ? 'Cannot update pricing tiers: this product has variants referenced by active carts or orders.'
            : `Tier save failed (HTTP ${res.status})`);
        toast.error(message);
        return;
      }
      const updated = json.data as ApiProduct;
      setProduct(updated);
      setRows(toRows(updated.priceTiers ?? []));
      toast.success(json.message || 'Pricing tiers saved');
    } catch {
      toast.error('Network error while saving. Check your connection and retry.');
    } finally {
      setSaving(false);
    }
  };

  const ErrorState = () => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
      <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        {state === 'auth' && (
          <button
            type="button"
            onClick={() => navigate('login')}
            className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium"
          >
            Sign in
          </button>
        )}
        <button
          type="button"
          onClick={fetchProduct}
          className="min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={goBack}
          aria-label="Go back"
          className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Pricing Tiers</h1>
      </div>

      <div className="p-4 space-y-6 md:p-6 md:max-w-4xl md:mx-auto md:pt-8">
        <div className="hidden md:flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pricing Tiers</h1>
          {product && (
            <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate min-w-0">
              {product.name} · base ৳{basePrice}/{product.unit}
            </span>
          )}
        </div>

        {state === 'loading' && (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-40 md:h-64 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-lg animate-pulse" />
          </div>
        )}

        {(state === 'auth' || state === 'error' || state === 'notfound') && <ErrorState />}

        {state === 'ready' && (
          <>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Volume discount curve</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                  Each bar shows the per-unit price buyers pay at that quantity break. The dashed line is
                  the list price (৳{basePrice}/{product?.unit}) — discount tiers fall below it.
                </p>
              </div>

              {chartData.length === 0 ? (
                <div className="h-40 md:h-64 bg-gray-50 dark:bg-gray-950 rounded-lg flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400 text-center px-4">
                  No pricing tiers yet — add one below to chart the discount curve.
                </div>
              ) : (
                <div className="relative h-40 md:h-64 bg-gray-50 dark:bg-gray-950 rounded-lg p-3 overflow-x-auto no-scrollbar">
                  <div className="relative h-full min-w-full flex items-end gap-2">
                    {/* Base price reference line */}
                    {basePrice > 0 && (
                      <div
                        className="absolute left-0 right-0 border-t-2 border-dashed border-primary/40 z-10"
                        style={{ bottom: `${(basePrice / maxPrice) * 100}%` }}
                      >
                        <span className="absolute -top-5 right-0 text-[10px] text-primary font-medium bg-white dark:bg-gray-900 px-1 rounded">
                          list ৳{basePrice}
                        </span>
                      </div>
                    )}
                    {chartData.map((d, i) => {
                      const heightPct = (d.price / maxPrice) * 100;
                      const label = d.maxQty == null ? `${d.qty}+` : `${d.qty}–${d.maxQty}`;
                      const discountPct =
                        basePrice > 0
                          ? Math.round((1 - d.price / basePrice) * 100)
                          : 0;
                      return (
                        <div
                          key={i}
                          className="flex-1 min-w-[60px] h-full flex flex-col justify-end items-center gap-1"
                        >
                          <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                            ৳{d.price}
                          </span>
                          <div
                            className="w-full max-w-[48px] rounded-t-md bg-primary/80 dark:bg-primary/70"
                            style={{ height: `${heightPct}%` }}
                            title={`${label} units → ৳${d.price}/unit (${discountPct}% off)`}
                          />
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center leading-tight">
                            {label}
                            {discountPct > 0 && (
                              <span className="block text-emerald-600 dark:text-emerald-400">-{discountPct}%</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  Tier rules <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 font-normal">({tiers.length})</span>
                </h2>
                <button
                  onClick={addTier}
                  className="text-primary text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Tier
                </button>
              </div>

              {tiers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-6">
                  No tiers configured. Buyers pay the list price (৳{basePrice}) at every quantity.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 px-1">
                    <div className="col-span-3">Min qty</div>
                    <div className="col-span-3">Max qty (blank = open)</div>
                    <div className="col-span-3">Price / unit ৳</div>
                    <div className="col-span-2">Discount</div>
                    <div className="col-span-1" />
                  </div>
                  {tiers.map((tier, i) => {
                    const price = Number(tier.pricePerUnit);
                    const discount =
                      basePrice > 0 && Number.isFinite(price) && price > 0
                        ? Math.round((1 - price / basePrice) * 100)
                        : null;
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center"
                      >
                        <input
                          type="number"
                          inputMode="decimal"
                          value={tier.minQty}
                          onChange={(e) => updateTier(i, 'minQty', e.target.value)}
                          placeholder="Min qty"
                          className="sm:col-span-3 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          value={tier.maxQty}
                          onChange={(e) => updateTier(i, 'maxQty', e.target.value)}
                          placeholder="Max (blank=open)"
                          className="sm:col-span-3 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={tier.pricePerUnit}
                          onChange={(e) => updateTier(i, 'pricePerUnit', e.target.value)}
                          placeholder="Price / unit"
                          className="sm:col-span-3 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                        <div className="sm:col-span-2 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 px-1">
                          {discount != null && discount > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              -{discount}%
                            </span>
                          ) : discount === 0 ? (
                            <span className="text-gray-400 dark:text-gray-500">list</span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 dark:text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeTier(i)}
                          className="sm:col-span-1 p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 justify-self-end"
                          aria-label="Remove tier"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full md:w-auto md:px-10 bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Applying…' : 'Apply Rules'}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default ProductPricingTiersPage;
