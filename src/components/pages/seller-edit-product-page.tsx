'use client';

/**
 * Seller edit-product page (Task 50-a) — REAL hydration + REAL update.
 * The old page read title/unitType off the raw API row (fields that don't
 * exist) so it hydrated blank, and PATCHed the renamed keys straight back.
 * Now it hydrates from the canonical GET shape (name/unit/priceTiers[].pricePerUnit/
 * images[].imageUrl/…) and PATCHes the full canonical contract via the shared
 * form; every API error is surfaced verbatim and navigation happens only on a
 * real 200.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { productPayloadSchema } from '@/lib/product-contract';
import {
  ProductFormFields,
  emptyTier,
  flattenApiCategories,
  type ApiCategoryRow,
  type ProductFormState,
  type TierRow,
  type VariantRow,
  type MediaImage,
  type MediaVideo,
  type CategoryOption,
} from '@/components/pages/product-form-fields';

interface ApiProduct {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  brand: string | null;
  sku: string | null;
  unit: string;
  moq: number;
  maxOrderQty: number | null;
  basePrice: number;
  stockQuantity: number;
  isCustomizable: boolean;
  isActive: boolean;
  isApproved: boolean;
  images: Array<{ imageUrl: string; sortOrder: number }>;
  videos: Array<{ videoUrl: string; title: string | null; sortOrder: number }>;
  variants: Array<{
    variantName: string;
    variantValue: string;
    sku: string | null;
    stockQuantity: number;
    priceOverride: number | null;
  }>;
  priceTiers: Array<{ minQty: number; maxQty: number | null; pricePerUnit: number }>;
}

function optionalQty(value: string): number | null {
  const t = value.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : NaN; // NaN → surfaced by the Zod check
}

export function SellerEditProductPage() {
  const { goBack, navigate, pageParams } = useNavigationStore();
  const token = useAuthStore((s) => s.token);
  const productId = typeof pageParams?.productId === 'string' ? pageParams.productId : '';

  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [moderation, setModeration] = useState<{ isActive: boolean; isApproved: boolean } | null>(null);

  const [form, setForm] = useState<ProductFormState>({
    name: '',
    categoryId: '',
    brand: '',
    sku: '',
    description: '',
    unit: 'pcs',
    moq: '',
    maxOrderQty: '',
    basePrice: '',
    stockQuantity: '',
    isCustomizable: false,
    isActive: true,
  });
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [images, setImages] = useState<MediaImage[]>([]);
  const [videos, setVideos] = useState<MediaVideo[]>([]);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverIssues, setServerIssues] = useState<Record<string, string[]>>({});

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await fetch('/api/categories');
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setCategories(flattenApiCategories(json.data as ApiCategoryRow[]));
      } else {
        setCategories([]);
      }
    } catch {
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setFetchError('No product was selected to edit.');
      setFetching(false);
      return;
    }
    setFetching(true);
    setFetchError('');
    try {
      const res = await fetch(`/api/supplier/products/${productId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true);
        setFetchError(json?.error || 'Sign in as the listing owner to edit this product.');
        return;
      }
      if (res.status === 404) {
        setNotFound(true);
        setFetchError('Product not found — it may have been removed, or it belongs to another seller.');
        return;
      }
      if (!res.ok || !json?.success || !json?.data) {
        setFetchError(json?.error || `Failed to load the product (HTTP ${res.status})`);
        return;
      }
      const p = json.data as ApiProduct;
      setModeration({ isActive: p.isActive, isApproved: p.isApproved });
      setForm({
        name: p.name ?? '',
        categoryId: p.categoryId ?? '',
        brand: p.brand ?? '',
        sku: p.sku ?? '',
        description: p.description ?? '',
        unit: (p.unit as ProductFormState['unit']) || 'pcs',
        moq: String(p.moq ?? ''),
        maxOrderQty: p.maxOrderQty == null ? '' : String(p.maxOrderQty),
        basePrice: String(p.basePrice ?? ''),
        stockQuantity: String(p.stockQuantity ?? ''),
        isCustomizable: Boolean(p.isCustomizable),
        isActive: Boolean(p.isActive),
      });
      setTiers(
        (p.priceTiers ?? []).map((t) => ({
          minQty: String(t.minQty),
          maxQty: t.maxQty == null ? '' : String(t.maxQty),
          pricePerUnit: String(t.pricePerUnit),
        }))
      );
      if ((p.priceTiers ?? []).length === 0) setTiers([emptyTier()]);
      setVariants(
        (p.variants ?? []).map((v) => ({
          variantName: v.variantName,
          variantValue: v.variantValue,
          sku: v.sku ?? '',
          stockQuantity: String(v.stockQuantity),
          priceOverride: v.priceOverride == null ? '' : String(v.priceOverride),
        }))
      );
      setImages(
        (p.images ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((img) => ({ url: img.imageUrl, fileName: `image-${img.sortOrder}`, status: 'ready' as const }))
      );
      setVideos(
        (p.videos ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((v) => ({ url: v.videoUrl, title: v.title ?? '', fileName: 'video', status: 'ready' as const }))
      );
    } catch {
      setFetchError('Network error while loading the product. Check your connection and retry.');
    } finally {
      setFetching(false);
    }
  }, [productId, token]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const buildPayload = () => {
    const moq = optionalQty(form.moq);
    const maxOrderQty = optionalQty(form.maxOrderQty);
    const readyImages = images.filter((img) => img.status === 'ready');
    return {
      name: form.name.trim(),
      categoryId: form.categoryId,
      description: form.description.trim(),
      ...(form.brand.trim() ? { brand: form.brand.trim() } : {}),
      ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
      unit: form.unit,
      moq,
      ...(maxOrderQty !== null ? { maxOrderQty } : { maxOrderQty: null }),
      basePrice: form.basePrice.trim() === '' ? NaN : Number(form.basePrice),
      currency: 'BDT' as const,
      stockQuantity: form.stockQuantity.trim() === '' ? NaN : Number(form.stockQuantity),
      isCustomizable: form.isCustomizable,
      thumbnailUrl: readyImages.length > 0 ? readyImages[0].url : null,
      images: readyImages.map((img, index) => ({ imageUrl: img.url, sortOrder: index })),
      videos: videos
        .filter((v) => v.status === 'ready')
        .map((v) => ({ url: v.url, ...(v.title.trim() ? { title: v.title.trim() } : {}) })),
      variants: variants
        .filter((v) => v.variantName.trim() && v.variantValue.trim())
        .map((v) => ({
          variantName: v.variantName.trim(),
          variantValue: v.variantValue.trim(),
          ...(v.sku.trim() ? { sku: v.sku.trim() } : {}),
          stockQuantity: v.stockQuantity.trim() === '' ? NaN : Number(v.stockQuantity),
          ...(v.priceOverride.trim() ? { priceOverride: Number(v.priceOverride) } : { priceOverride: null }),
        })),
      priceTiers: tiers
        .filter((t) => t.minQty.trim() !== '' || t.pricePerUnit.trim() !== '')
        .map((t) => ({
          minQty: t.minQty.trim() === '' ? NaN : Number(t.minQty),
          ...(t.maxQty.trim() !== '' ? { maxQty: Number(t.maxQty) } : { maxQty: null }),
          pricePerUnit: t.pricePerUnit.trim() === '' ? NaN : Number(t.pricePerUnit),
        })),
      isActive: form.isActive,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !productId) return;

    const uploadingCount =
      images.filter((i) => i.status === 'uploading').length + videos.filter((v) => v.status === 'uploading').length;
    if (uploadingCount > 0) {
      toast.error('Wait for all uploads to finish before saving.');
      return;
    }

    const payload = buildPayload();
    const parsed = productPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0];
      const message = flattened.formErrors[0] ?? firstFieldIssue ?? 'Please fix the highlighted fields.';
      setError(message);
      setServerIssues(flattened.fieldErrors as Record<string, string[]>);
      toast.error(message);
      return;
    }

    setLoading(true);
    setError('');
    setServerIssues({});
    try {
      const res = await fetch(`/api/supplier/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ ...parsed.data, isActive: form.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message = json?.error || `Product update failed (HTTP ${res.status})`;
        setError(message);
        if (json?.issues) setServerIssues(json.issues as Record<string, string[]>);
        toast.error(message);
        return; // never navigate on failure
      }
      toast.success(json.message || 'Product updated');
      setModeration((prev) => (prev ? { ...prev, isActive: form.isActive } : prev));
      goBack();
    } catch {
      const message = 'Network error while updating the product. Check your connection and retry.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" role="status" aria-label="Loading product">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || needsAuth || fetchError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gray-50 pb-20 md:pb-8"
      >
        <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Edit Product</h1>
        </div>
        <div className="p-4 max-w-3xl mx-auto md:p-6 md:pt-10">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-gray-700">{fetchError}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => navigate('login')}
                className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={fetchProduct}
                className="min-h-11 px-4 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Retry
              </button>
            </div>
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
      className="min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 rounded-full flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Edit Product</h1>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6 md:p-6 md:pt-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
          {moderation && (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium border ${
                !moderation.isApproved && moderation.isActive
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : moderation.isApproved && moderation.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {!moderation.isApproved && moderation.isActive
                ? 'Pending review'
                : moderation.isApproved && moderation.isActive
                  ? 'Approved'
                  : 'Hidden'}
            </span>
          )}
        </div>

        {moderation && !moderation.isApproved && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            This listing is still awaiting admin review — buyers cannot see it yet. You can keep editing it.
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <ProductFormFields
            form={form}
            onFormChange={(patch) => {
              setForm((prev) => ({ ...prev, ...patch }));
              setError('');
            }}
            tiers={tiers}
            onTiersChange={setTiers}
            variants={variants}
            onVariantsChange={setVariants}
            images={images}
            onImagesChange={setImages}
            videos={videos}
            onVideosChange={setVideos}
            categories={categories}
            categoriesLoading={categoriesLoading}
            showIsActive
            serverIssues={serverIssues}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? 'Saving…' : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

export default SellerEditProductPage;
