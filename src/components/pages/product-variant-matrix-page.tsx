'use client';

/**
 * Product variant matrix (Task 175-a) — REAL hydration + REAL save.
 *
 * The previous page seeded fake "Color: Red/Blue/Black" + "Size: M/L/XL"
 * attributes and the Save Matrix button had no onClick. The real rail at
 * GET /api/supplier/products/[id] returns the product's real productVariants
 * rows ({ variantName, variantValue, sku, stockQuantity, priceOverride }).
 * There is no dedicated variant writer rail — the canonical writer is the
 * PATCH /api/supplier/products/[id] full-replace (the same contract
 * seller-edit-product-page uses). On Save, the page rebuilds the full
 * canonical payload from the loaded product, overrides only the variants
 * array with the seller's edited matrix, and PATCHes. A 409 (variant FK
 * restrict from active carts/orders) is surfaced honestly.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Save, Plus, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';

interface ApiVariant {
  id: string;
  variantName: string;
  variantValue: string;
  sku: string | null;
  stockQuantity: number;
  priceOverride: number | null;
}
interface ApiTier {
  id: string;
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
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

interface VariantRow {
  variantName: string;
  variantValue: string;
  sku: string;
  stockQuantity: string;
  priceOverride: string;
}

type LoadState = 'loading' | 'auth' | 'notfound' | 'error' | 'ready';

function toRows(variants: ApiVariant[]): VariantRow[] {
  return variants.map((v) => ({
    variantName: v.variantName,
    variantValue: v.variantValue,
    sku: v.sku ?? '',
    stockQuantity: String(v.stockQuantity),
    priceOverride: v.priceOverride == null ? '' : String(v.priceOverride),
  }));
}

function buildFullReplacePayload(p: ApiProduct, variants: VariantRow[]) {
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
    variants: variants
      .filter((v) => v.variantName.trim() && v.variantValue.trim())
      .map((v) => ({
        variantName: v.variantName.trim(),
        variantValue: v.variantValue.trim(),
        ...(v.sku.trim() ? { sku: v.sku.trim() } : {}),
        stockQuantity: v.stockQuantity.trim() === '' ? 0 : Number(v.stockQuantity),
        ...(v.priceOverride.trim()
          ? { priceOverride: Number(v.priceOverride) }
          : { priceOverride: null }),
      })),
    priceTiers: p.priceTiers.map((t) => ({
      minQty: t.minQty,
      ...(t.maxQty != null ? { maxQty: t.maxQty } : { maxQty: null }),
      pricePerUnit: t.pricePerUnit,
    })),
  };
}

export function ProductVariantMatrixPage() {
  const { goBack, navigate, pageParams } = useNavigationStore();
  const token = useAuthStore((s) => s.token);
  const productId = typeof pageParams?.productId === 'string' ? pageParams.productId : (typeof pageParams?.id === 'string' ? pageParams.id : '');

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setState('error');
      setLoadError('No product was selected. Open this page from a product listing.');
      return;
    }
    if (!token) {
      setState('auth');
      setLoadError('Sign in as the product owner to manage variants.');
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
        setLoadError(json?.error || 'Sign in as the product owner to manage variants.');
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
      setRows(toRows(p.variants ?? []));
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading the product. Check your connection and retry.');
    }
  }, [productId, token]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // Group rows by variantName for the matrix display.
  const groups = useMemo(() => {
    const map = new Map<string, { index: number; row: VariantRow }[]>();
    rows.forEach((row, index) => {
      const key = row.variantName.trim() || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ index, row });
    });
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  }, [rows]);

  const addRow = (groupName = '') => {
    setRows((prev) => [
      ...prev,
      {
        variantName: groupName,
        variantValue: '',
        sku: '',
        stockQuantity: '0',
        priceOverride: '',
      },
    ]);
  };
  const updateRow = (index: number, field: keyof VariantRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };
  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (saving || !product || !productId) return;
    // Validate before submit.
    for (const r of rows) {
      if (r.variantName.trim() && !r.variantValue.trim()) {
        toast.error('Every variant value must be filled in (or remove the empty row).');
        return;
      }
      if (r.stockQuantity.trim() !== '' && (!Number.isFinite(Number(r.stockQuantity)) || Number(r.stockQuantity) < 0)) {
        toast.error('Variant stock must be a number ≥ 0.');
        return;
      }
      if (r.priceOverride.trim() !== '' && (!Number.isFinite(Number(r.priceOverride)) || Number(r.priceOverride) <= 0)) {
        toast.error('Variant price override must be a number > 0.');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = buildFullReplacePayload(product, rows);
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
            ? 'Cannot replace variants: this product has variants referenced by active carts or orders. Hide the listing instead.'
            : `Variant save failed (HTTP ${res.status})`);
        toast.error(message);
        return;
      }
      const updated = json.data as ApiProduct;
      setProduct(updated);
      setRows(toRows(updated.variants ?? []));
      toast.success(json.message || 'Variant matrix saved');
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
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Variant Matrix</h1>
      </div>

      <div className="p-4 space-y-6 md:p-6 md:max-w-4xl md:mx-auto md:pt-8">
        <div className="hidden md:flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Variant Matrix</h1>
          {product && (
            <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate min-w-0">
              {product.name}
            </span>
          )}
        </div>

        {state === 'loading' && (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-20 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-20 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-lg animate-pulse" />
          </div>
        )}

        {(state === 'auth' || state === 'error' || state === 'notfound') && <ErrorState />}

        {state === 'ready' && (
          <>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  Variants <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 font-normal">({rows.length})</span>
                </h2>
                <button
                  onClick={() => addRow()}
                  className="text-primary text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Variant
                </button>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-6">
                  No variants on this product yet. Add a variant to offer different colors, sizes, or
                  materials.
                </p>
              ) : (
                <div className="space-y-4">
                  {groups.map((group) => (
                    <div
                      key={group.name}
                      className="p-3 border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 space-y-3"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <input
                          type="text"
                          value={group.name === '—' ? '' : group.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setRows((prev) =>
                              prev.map((r, i) =>
                                group.items.some((it) => it.index === i)
                                  ? { ...r, variantName: newName }
                                  : r,
                              ),
                            );
                          }}
                          placeholder="Attribute name (e.g., Color)"
                          className="bg-transparent font-medium text-gray-900 dark:text-gray-100 focus:outline-none flex-1 min-w-0"
                        />
                        <button
                          onClick={() => addRow(group.name === '—' ? '' : group.name)}
                          className="text-primary text-xs font-medium flex items-center gap-1 flex-shrink-0"
                        >
                          <Plus className="w-3 h-3" /> Value
                        </button>
                      </div>
                      <div className="space-y-2">
                        {group.items.map(({ index, row }) => (
                          <div
                            key={index}
                            className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center"
                          >
                            <input
                              type="text"
                              value={row.variantValue}
                              onChange={(e) => updateRow(index, 'variantValue', e.target.value)}
                              placeholder="Value (e.g., Red)"
                              className="sm:col-span-3 px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                            <input
                              type="text"
                              value={row.sku}
                              onChange={(e) => updateRow(index, 'sku', e.target.value)}
                              placeholder="SKU"
                              className="sm:col-span-3 px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                            <input
                              type="number"
                              inputMode="numeric"
                              value={row.stockQuantity}
                              onChange={(e) => updateRow(index, 'stockQuantity', e.target.value)}
                              placeholder="Stock"
                              className="sm:col-span-2 px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={row.priceOverride}
                              onChange={(e) => updateRow(index, 'priceOverride', e.target.value)}
                              placeholder="Price ৳"
                              className="sm:col-span-3 px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                            <button
                              onClick={() => removeRow(index)}
                              className="sm:col-span-1 p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 justify-self-end"
                              aria-label="Remove variant"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Summary</h2>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Total variants</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{rows.length}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Attributes</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{groups.length}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Total stock</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {rows.reduce((sum, r) => sum + (Number(r.stockQuantity) || 0), 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">With price override</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {rows.filter((r) => r.priceOverride.trim() !== '').length}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full md:w-auto md:px-10 bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving…' : 'Save Matrix'}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default ProductVariantMatrixPage;
