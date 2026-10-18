'use client';

/**
 * Seller add-product page (Task 50-a) — REAL product creation against the
 * canonical contract. Fields map 1:1 to prisma `products` (+ child tables);
 * the old payload {title, unitType:'piece', pricingTiers[].price …} never
 * matched the API and every submit died as 400/500. Now:
 *  - payload = productPayloadSchema (name/categoryId/unit/moq/basePrice/…)
 *  - client-side Zod validation mirrors the server (one shared contract lib)
 *  - images/videos upload to /api/uploads/product-media and the returned URLs
 *    are submitted in the contract
 *  - every API error is surfaced verbatim; navigation happens ONLY on real 201
 *  - new products land in the moderation queue (isApproved=false) — the page
 *    says so honestly after creation.
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
  EMPTY_PRODUCT_FORM,
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

function optionalQty(value: string): number | null {
  const t = value.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : NaN; // NaN → surfaced by the Zod check
}

export function SellerAddProductPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [tiers, setTiers] = useState<TierRow[]>([{ minQty: '', maxQty: '', pricePerUnit: '' }]);
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
        // Honest: leave the list empty; the select explains it.
        setCategories([]);
      }
    } catch {
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleFormChange = (patch: Partial<ProductFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError('');
  };

  const buildPayload = () => {
    const moq = optionalQty(form.moq);
    const maxOrderQty = optionalQty(form.maxOrderQty);
    const stockQuantity = form.stockQuantity.trim() === '' ? NaN : Number(form.stockQuantity);
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
      stockQuantity,
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
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const uploadingCount =
      images.filter((i) => i.status === 'uploading').length + videos.filter((v) => v.status === 'uploading').length;
    if (uploadingCount > 0) {
      toast.error('Wait for all uploads to finish before publishing.');
      return;
    }

    // Client-side validation with the SAME contract the server enforces.
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
      const res = await fetch('/api/supplier/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        // Real backend error verbatim (401 auth, 403 no profile, 400 Zod, 429 limit).
        const message = json?.error || `Product creation failed (HTTP ${res.status})`;
        setError(message);
        if (json?.issues) setServerIssues(json.issues as Record<string, string[]>);
        toast.error(message);
        return; // never navigate on failure
      }
      toast.success(json.message || 'Product created');
      navigate('product-listings-manager');
    } catch {
      const message = 'Network error while creating the product. Check your connection and retry.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Add New Product</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6 md:p-6 md:pt-6">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Add New Product</h1>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700">
              {error}
              {(error.includes('Authentication') || error.includes('sign in')) && (
                <button
                  type="button"
                  onClick={() => navigate('login')}
                  className="block mt-2 min-h-11 px-4 bg-red-600 text-white rounded-lg text-sm font-medium"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <ProductFormFields
            form={form}
            onFormChange={handleFormChange}
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
            serverIssues={serverIssues}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? 'Publishing…' : (
              <>
                <Save className="w-5 h-5" />
                Publish Product
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 text-center -mt-2">
            New listings go to the moderation queue — an admin approves them before buyers can see them.
          </p>
        </form>
      </div>
    </motion.div>
  );
}

export default SellerAddProductPage;
