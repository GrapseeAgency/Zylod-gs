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
  parseBundleSize,
  uploadAndAttachVideo,
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
  /**
   * Task 55-c honest partial success: the product row EXISTS but one or more
   * video uploads/attaches failed after creation. The page must say exactly
   * that — never navigate away as if everything succeeded.
   */
  const [createdWithVideoErrors, setCreatedWithVideoErrors] = useState<{ productId: string; failures: string[] } | null>(null);

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
    const bundleSize = parseBundleSize(form.bundleSize);
    const stockQuantity = form.stockQuantity.trim() === '' ? NaN : Number(form.stockQuantity);
    // Task 57-b: '' = platform default (omit); otherwise decimal ≥ 0.
    const stockAlertThreshold = form.stockAlertThreshold.trim() === '' ? null : Number(form.stockAlertThreshold);
    const readyImages = images.filter((img) => img.status === 'ready');

    return {
      name: form.name.trim(),
      categoryId: form.categoryId,
      description: form.description.trim(),
      ...(form.brand.trim() ? { brand: form.brand.trim() } : {}),
      ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
      unit: form.unit,
      bundleSize,
      moq,
      ...(maxOrderQty !== null ? { maxOrderQty } : { maxOrderQty: null }),
      basePrice: form.basePrice.trim() === '' ? NaN : Number(form.basePrice),
      currency: 'BDT' as const,
      stockQuantity,
      stockAlertThreshold,
      isCustomizable: form.isCustomizable,
      thumbnailUrl: readyImages.length > 0 ? readyImages[0].url : null,
      images: readyImages.map((img, index) => ({ imageUrl: img.url, sortOrder: index })),
      // Task 55-c: only rows that already carry an uploaded URL go in the
      // payload; picked-file rows attach via /api/upload/video after create.
      // Task 67-c: every row carries its FORM index as sortOrder so payload
      // rows and post-write file attaches land in the seller's exact order.
      videos: videos
        .map((v, idx) => ({ v, idx }))
        .filter(({ v }) => v.url !== '' && v.status === 'ready')
        .map(({ v, idx }) => ({
          url: v.url,
          sortOrder: idx,
          ...(v.title.trim() ? { title: v.title.trim() } : {}),
        })),
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

  /** Task 55-c + 67-b: attach every picked FILE video after the product write.
   *  External https:// links do NOT go through here — they ride the create
   *  payload itself (transactional, sortOrder = form index), so attaching
   *  them again here would create duplicates (the exact bug the browser QA
   *  caught on the first Task 67 run). Task 67-c: each file attaches with its
   *  FORM index so mixed file+link rows keep the seller's exact order. */
  const attachPendingVideos = async (productId: string): Promise<string[]> => {
    const failures: string[] = [];
    for (let idx = 0; idx < videos.length; idx++) {
      const file = videos[idx].file;
      if (!file || videos[idx].status === 'error') continue;
      const result = await uploadAndAttachVideo(productId, file, videos[idx].title, idx, token);
      if (!result.ok && result.error) failures.push(`${videos[idx].fileName}: ${result.error}`);
    }
    return failures;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const uploadingCount = images.filter((i) => i.status === 'uploading').length;
    if (uploadingCount > 0) {
      toast.error('Wait for all image uploads to finish before publishing.');
      return;
    }

    const bundleSizeNumber = Number(form.bundleSize);
    if (
      form.unit !== 'pcs' &&
      form.bundleSize.trim() !== '' &&
      (!Number.isFinite(bundleSizeNumber) || bundleSizeNumber <= 1)
    ) {
      const message = 'Bundle size must be greater than 1 (units per bundle) — or leave it empty for single units.';
      setError(message);
      toast.error(message);
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
    setCreatedWithVideoErrors(null);
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
      const productId: string = json.data?.id ?? '';

      // Task 55-c two-step video attach — AFTER the product exists. A failure
      // here never un-creates the product: surface exactly what happened.
      const failures = productId ? await attachPendingVideos(productId) : [];
      if (failures.length > 0) {
        setCreatedWithVideoErrors({ productId, failures });
        toast.success('Product created');
        toast.error('Video upload/attach failed — the product still exists.');
        return; // stay on the page with the honest partial-success panel
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

        {createdWithVideoErrors && (
          <div className="space-y-2" role="alert">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
              ✓ Product created — it is pending admin review before buyers can see it.
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
              <p className="font-medium">Video upload/attach failed — the product STILL EXISTS:</p>
              <ul className="list-disc ml-5 mt-1 space-y-0.5">
                {createdWithVideoErrors.failures.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <p className="mt-1">You can attach the video from the edit page of this listing.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('product-listings-manager')}
              className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium"
            >
              Go to my listings
            </button>
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
