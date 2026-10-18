'use client';

/**
 * Shared seller product form fields (Task 50-a) — used by the add-product and
 * edit-product pages. ONE canonical implementation of:
 *  - basic info / pricing / stock inputs (real products schema fields only)
 *  - the tier editor (minQty/maxQty/pricePerUnit with ≤basePrice inline errors)
 *  - the variant editor (variantName/variantValue/sku/stockQuantity/priceOverride)
 *  - REAL media upload: files POST to /api/uploads/product-media immediately on
 *    select; returned URLs live in form state and go into the canonical contract.
 *    The old decorative dropzone (no <input type=file>) is gone.
 *
 * Fields with NO schema backing were deleted: hsCode, sampleAvailable/
 * samplePrice, weight, leadTimeDays — products has no such columns (verified
 * against prisma/schema.prisma).
 */
import React, { useRef, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Plus, Trash2, Video as VideoIcon, X } from 'lucide-react';
import { PRODUCT_UNITS, PRODUCT_UNIT_LABELS, type ProductUnit } from '@/lib/product-contract';

export interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}

export interface ProductFormState {
  name: string;
  categoryId: string;
  brand: string;
  sku: string;
  description: string;
  unit: ProductUnit;
  moq: string;
  maxOrderQty: string;
  basePrice: string;
  stockQuantity: string;
  isCustomizable: boolean;
  /** Edit page only (schema-backed products.isActive); the add page ignores it. */
  isActive: boolean;
}

export interface TierRow {
  minQty: string;
  maxQty: string; // '' = open-ended (null)
  pricePerUnit: string;
}

export interface VariantRow {
  variantName: string;
  variantValue: string;
  sku: string;
  stockQuantity: string;
  priceOverride: string; // '' = no override
}

export interface MediaImage {
  url: string;
  fileName: string;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

export interface MediaVideo {
  url: string;
  title: string;
  fileName: string;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

export interface ProductFormFieldsProps {
  form: ProductFormState;
  onFormChange: (patch: Partial<ProductFormState>) => void;
  tiers: TierRow[];
  onTiersChange: Dispatch<SetStateAction<TierRow[]>>;
  variants: VariantRow[];
  onVariantsChange: Dispatch<SetStateAction<VariantRow[]>>;
  images: MediaImage[];
  onImagesChange: Dispatch<SetStateAction<MediaImage[]>>;
  videos: MediaVideo[];
  onVideosChange: Dispatch<SetStateAction<MediaVideo[]>>;
  categories: CategoryOption[];
  categoriesLoading: boolean;
  /** Edit page only — the real isActive listing toggle (schema-backed). */
  showIsActive?: boolean;
  /** Server-side issues keyed by field (from a 400 response) merged into inline errors. */
  serverIssues?: Record<string, string[]>;
}

export const EMPTY_PRODUCT_FORM: ProductFormState = {
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
};

/** Real GET /api/categories row (root categories with nested children). */
export interface ApiCategoryRow {
  id: string;
  name: string;
  children?: ApiCategoryRow[];
}

/** Flatten the category tree into indented select options (roots → children → grandchildren). */
export function flattenApiCategories(rows: ApiCategoryRow[], depth = 0): CategoryOption[] {
  return rows.flatMap((c) => [
    { id: c.id, name: c.name, depth },
    ...(c.children && c.children.length > 0 ? flattenApiCategories(c.children, depth + 1) : []),
  ]);
}

export function emptyTier(): TierRow {
  return { minQty: '', maxQty: '', pricePerUnit: '' };
}

export function emptyVariant(): VariantRow {
  return { variantName: '', variantValue: '', sku: '', stockQuantity: '', priceOverride: '' };
}

export interface TierRowErrors {
  minQty?: string;
  maxQty?: string;
  pricePerUnit?: string;
}

/** Client-side mirror of the server tier rules (the server re-checks everything). */
export function computeTierErrors(tiers: TierRow[], basePrice: number): { rowErrors: TierRowErrors[]; global: string } {
  const rowErrors: TierRowErrors[] = tiers.map(() => ({}));
  let global = '';

  const parsed = tiers.map((t) => ({
    minQty: t.minQty.trim() === '' ? null : Number(t.minQty),
    maxQty: t.maxQty.trim() === '' ? null : Number(t.maxQty),
    pricePerUnit: t.pricePerUnit.trim() === '' ? null : Number(t.pricePerUnit),
  }));

  parsed.forEach((t, i) => {
    if (t.minQty !== null && (!Number.isInteger(t.minQty) || t.minQty < 1)) {
      rowErrors[i].minQty = 'Min qty must be a whole number ≥ 1';
    }
    if (t.maxQty !== null && (!Number.isInteger(t.maxQty) || t.maxQty < 1)) {
      rowErrors[i].maxQty = 'Max qty must be a whole number ≥ 1';
    }
    if (t.pricePerUnit !== null && (!(t.pricePerUnit > 0) || !Number.isFinite(t.pricePerUnit))) {
      rowErrors[i].pricePerUnit = 'Price must be greater than 0';
    } else if (t.pricePerUnit !== null && Number.isFinite(basePrice) && basePrice > 0 && t.pricePerUnit > basePrice) {
      rowErrors[i].pricePerUnit = 'Tier price must be ≤ the base price';
    }
    if (t.minQty !== null && t.maxQty !== null && t.maxQty < t.minQty) {
      rowErrors[i].maxQty = 'Max qty must be ≥ min qty';
    }
  });

  for (let i = 1; i < parsed.length; i++) {
    const prev = parsed[i - 1];
    const cur = parsed[i];
    if (cur.minQty === null || prev.minQty === null) continue;
    if (cur.minQty <= prev.minQty && rowErrors[i].minQty === undefined) {
      rowErrors[i].minQty = 'Min qty must strictly increase across tiers';
      global = 'Tier minimum quantities must strictly increase with no overlapping ranges.';
    }
    if (prev.maxQty !== null && cur.minQty <= prev.maxQty && rowErrors[i].minQty === undefined) {
      rowErrors[i].minQty = `Overlaps the tier ending at ${prev.maxQty}`;
      global = 'Tier quantity ranges must not overlap.';
    }
    if (prev.maxQty === null && rowErrors[i - 1].maxQty === undefined) {
      rowErrors[i - 1].maxQty = 'Only the LAST tier may be open-ended';
      global = 'Only the last tier may have an empty max quantity.';
    }
  }

  return { rowErrors, global };
}

const inputClass =
  'w-full min-h-11 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600 mt-1">{message}</p>;
}

/** Upload one file to the real product-media endpoint; returns the public URL. */
async function uploadProductMedia(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/uploads/product-media', { method: 'POST', body, credentials: 'include' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.url) {
    // Real backend error verbatim (400 mismatch, 413 size, 401 auth, 429 limit).
    throw new Error(json?.error || `Upload failed (HTTP ${res.status})`);
  }
  return String(json.url);
}

export function ProductFormFields(props: ProductFormFieldsProps) {
  const {
    form,
    onFormChange,
    tiers,
    onTiersChange,
    variants,
    onVariantsChange,
    images,
    onImagesChange,
    videos,
    onVideosChange,
    categories,
    categoriesLoading,
    showIsActive = false,
    serverIssues = {},
  } = props;

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const basePriceNumber = Number(form.basePrice);
  const { rowErrors: tierErrors, global: tierGlobalError } = computeTierErrors(tiers, basePriceNumber);

  const handleImagesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        toast.error(`${file.name}: only PNG, JPEG, or WebP images are accepted`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 5MB image limit`);
        continue;
      }
      accepted.push(file);
    }
    for (const file of accepted) {
      const placeholder: MediaImage = { url: '', fileName: file.name, status: 'uploading' };
      onImagesChange((current) => [...current, placeholder]);
      try {
        const url = await uploadProductMedia(file);
        onImagesChange((current) =>
          current.map((img) => (img === placeholder ? { ...placeholder, url, status: 'ready' as const } : img))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        toast.error(`${file.name}: ${message}`);
        onImagesChange((current) =>
          current.map((img) => (img === placeholder ? { ...placeholder, status: 'error' as const, error: message } : img))
        );
      }
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleVideoSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      toast.error(`${file.name}: only MP4 or WebM videos are accepted`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error(`${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 50MB video limit`);
      return;
    }
    const placeholder: MediaVideo = { url: '', title: '', fileName: file.name, status: 'uploading' };
    onVideosChange((current) => [...current, placeholder]);
    try {
      const url = await uploadProductMedia(file);
      onVideosChange((current) =>
        current.map((v) => (v === placeholder ? { ...placeholder, url, status: 'ready' as const } : v))
      );
      toast.success('Video uploaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error(`${file.name}: ${message}`);
      onVideosChange((current) =>
        current.map((v) => (v === placeholder ? { ...placeholder, status: 'error' as const, error: message } : v))
      );
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const uploadingCount =
    images.filter((i) => i.status === 'uploading').length + videos.filter((v) => v.status === 'uploading').length;

  return (
    <div className="space-y-6">
      {/* Basic information — every field below is backed by a real products column */}
      <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Basic Information</h2>

        <div className="space-y-1">
          <label htmlFor="pf-name" className="text-sm font-medium text-gray-700">Product name</label>
          <input
            id="pf-name"
            type="text"
            value={form.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
            required
            maxLength={200}
            className={inputClass}
            placeholder="e.g., Premium Cotton T-Shirt"
          />
          {serverIssues.name?.[0] && <FieldError message={serverIssues.name[0]} />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="pf-category" className="text-sm font-medium text-gray-700">Category</label>
            <select
              id="pf-category"
              value={form.categoryId}
              onChange={(e) => onFormChange({ categoryId: e.target.value })}
              required
              disabled={categoriesLoading || categories.length === 0}
              className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
            >
              <option value="">
                {categoriesLoading ? 'Loading categories…' : 'Select a category'}
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {'\u00A0'.repeat(c.depth * 4) + c.name}
                </option>
              ))}
            </select>
            {!categoriesLoading && categories.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No categories exist yet — products need a real category. Ask an admin to create marketplace categories first.
              </p>
            )}
            {serverIssues.categoryId?.[0] && <FieldError message={serverIssues.categoryId[0]} />}
          </div>
          <div className="space-y-1">
            <label htmlFor="pf-brand" className="text-sm font-medium text-gray-700">Brand <span className="text-gray-400">(optional)</span></label>
            <input
              id="pf-brand"
              type="text"
              value={form.brand}
              onChange={(e) => onFormChange({ brand: e.target.value })}
              maxLength={100}
              className={inputClass}
              placeholder="e.g., Zylod Basics"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="pf-sku" className="text-sm font-medium text-gray-700">SKU <span className="text-gray-400">(optional)</span></label>
          <input
            id="pf-sku"
            type="text"
            value={form.sku}
            onChange={(e) => onFormChange({ sku: e.target.value })}
            maxLength={100}
            className={inputClass}
            placeholder="Stock keeping unit code"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="pf-description" className="text-sm font-medium text-gray-700">Description</label>
          <textarea
            id="pf-description"
            value={form.description}
            onChange={(e) => onFormChange({ description: e.target.value })}
            required
            rows={4}
            maxLength={10000}
            className={`${inputClass} min-h-0`}
            placeholder="Materials, sizes, packaging, wholesale terms…"
          />
          {serverIssues.description?.[0] && <FieldError message={serverIssues.description[0]} />}
        </div>

        <label className="flex items-center gap-3 cursor-pointer min-h-11">
          <input
            type="checkbox"
            checked={form.isCustomizable}
            onChange={(e) => onFormChange({ isCustomizable: e.target.checked })}
            className="w-5 h-5 accent-primary"
          />
          <span className="text-sm font-medium text-gray-700">Supports custom orders (customizable)</span>
        </label>

        {showIsActive && (
          <label className="flex items-center gap-3 cursor-pointer min-h-11">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onFormChange({ isActive: e.target.checked })}
              className="w-5 h-5 accent-primary"
            />
            <span className="text-sm font-medium text-gray-700">Listing active (visible when approved)</span>
          </label>
        )}
      </section>

      {/* Pricing & inventory */}
      <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Pricing &amp; Inventory</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="pf-base-price" className="text-sm font-medium text-gray-700">Base price (BDT)</label>
            <input
              id="pf-base-price"
              type="number"
              min="0.01"
              step="0.01"
              value={form.basePrice}
              onChange={(e) => onFormChange({ basePrice: e.target.value })}
              required
              className={inputClass}
              placeholder="e.g., 450"
            />
            {serverIssues.basePrice?.[0] && <FieldError message={serverIssues.basePrice[0]} />}
          </div>
          <div className="space-y-1">
            <label htmlFor="pf-unit" className="text-sm font-medium text-gray-700">Unit</label>
            <select
              id="pf-unit"
              value={form.unit}
              onChange={(e) => onFormChange({ unit: e.target.value as ProductUnit })}
              className={inputClass}
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>{PRODUCT_UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="pf-moq" className="text-sm font-medium text-gray-700">
              MOQ (minimum order){form.unit === 'kg' ? ' — kg' : ''}
            </label>
            <input
              id="pf-moq"
              type="number"
              min={form.unit === 'kg' ? '0.1' : '1'}
              step={form.unit === 'kg' ? '0.5' : '1'}
              value={form.moq}
              onChange={(e) => onFormChange({ moq: e.target.value })}
              required
              className={inputClass}
              placeholder={form.unit === 'kg' ? 'e.g., 10' : 'e.g., 50'}
            />
            {serverIssues.moq?.[0] && <FieldError message={serverIssues.moq[0]} />}
          </div>
          <div className="space-y-1">
            <label htmlFor="pf-max-order" className="text-sm font-medium text-gray-700">Max order qty{form.unit === 'kg' ? ' (kg)' : ''} <span className="text-gray-400">(optional)</span></label>
            <input
              id="pf-max-order"
              type="number"
              min={form.unit === 'kg' ? '0.1' : '1'}
              step={form.unit === 'kg' ? '0.5' : '1'}
              value={form.maxOrderQty}
              onChange={(e) => onFormChange({ maxOrderQty: e.target.value })}
              className={inputClass}
              placeholder="No limit if empty"
            />
          </div>
          <div className="space-y-1 col-span-2">
            <label htmlFor="pf-stock" className="text-sm font-medium text-gray-700">Stock quantity{form.unit === 'kg' ? ' (kg)' : ''}</label>
            <input
              id="pf-stock"
              type="number"
              min="0"
              step={form.unit === 'kg' ? '0.5' : '1'}
              value={form.stockQuantity}
              onChange={(e) => onFormChange({ stockQuantity: e.target.value })}
              required
              className={inputClass}
              placeholder={form.unit === 'kg' ? 'e.g., 250.5' : 'e.g., 1200'}
            />
            {serverIssues.stockQuantity?.[0] && <FieldError message={serverIssues.stockQuantity[0]} />}
          </div>
        </div>

        {/* Tiered wholesale pricing — pricePerUnit ≤ basePrice enforced with inline errors */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Tiered wholesale pricing</h3>
            <button
              type="button"
              onClick={() => onTiersChange((current) => [...current, emptyTier()])}
              className="min-h-11 px-3 text-primary text-sm font-medium flex items-center gap-1 hover:bg-primary/5 rounded-lg"
            >
              <Plus className="w-4 h-4" /> Add tier
            </button>
          </div>
          {tierGlobalError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2">{tierGlobalError}</p>
          )}
          {tiers.length === 0 ? (
            <p className="text-xs text-gray-500">
              No tiers — buyers pay the base price at every quantity. Add a tier for volume discounts.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_44px] gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-1">
                <span>Min qty</span><span>Max qty (empty = open)</span><span>Price / unit (BDT)</span><span />
              </div>
              {tiers.map((tier, index) => (
                <div key={index} className="space-y-1 sm:grid sm:grid-cols-[1fr_1fr_1fr_44px] sm:gap-2 sm:items-start sm:space-y-0">
                  <div>
                    <input
                      type="number"
                      min={form.unit === 'kg' ? '0.1' : '1'}
                      step={form.unit === 'kg' ? '0.5' : '1'}
                      aria-label={`Tier ${index + 1} minimum quantity`}
                      placeholder="Min"
                      value={tier.minQty}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[index] = { ...tier, minQty: e.target.value };
                        onTiersChange(next);
                      }}
                      className={`${inputClass} sm:min-h-0 sm:py-1.5`}
                    />
                    <FieldError message={tierErrors[index]?.minQty || serverIssues[`priceTiers.${index}.minQty`]?.[0]} />
                  </div>
                  <div>
                    <input
                      type="number"
                      min={form.unit === 'kg' ? '0.1' : '1'}
                      step={form.unit === 'kg' ? '0.5' : '1'}
                      aria-label={`Tier ${index + 1} maximum quantity`}
                      placeholder="Max (empty = open)"
                      value={tier.maxQty}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[index] = { ...tier, maxQty: e.target.value };
                        onTiersChange(next);
                      }}
                      className={`${inputClass} sm:min-h-0 sm:py-1.5`}
                    />
                    <FieldError message={tierErrors[index]?.maxQty || serverIssues[`priceTiers.${index}.maxQty`]?.[0]} />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      aria-label={`Tier ${index + 1} price per unit`}
                      placeholder="Price"
                      value={tier.pricePerUnit}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[index] = { ...tier, pricePerUnit: e.target.value };
                        onTiersChange(next);
                      }}
                      className={`${inputClass} sm:min-h-0 sm:py-1.5`}
                    />
                    <FieldError message={tierErrors[index]?.pricePerUnit || serverIssues[`priceTiers.${index}.pricePerUnit`]?.[0]} />
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove tier ${index + 1}`}
                    onClick={() => onTiersChange(tiers.filter((_, i) => i !== index))}
                    className="min-h-11 min-w-11 p-2 text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variants */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Variants <span className="text-gray-400 font-normal">(optional)</span></h3>
            <button
              type="button"
              onClick={() => onVariantsChange((current) => [...current, emptyVariant()])}
              className="min-h-11 px-3 text-primary text-sm font-medium flex items-center gap-1 hover:bg-primary/5 rounded-lg"
            >
              <Plus className="w-4 h-4" /> Add variant
            </button>
          </div>
          {variants.length === 0 ? (
            <p className="text-xs text-gray-500">
              No variants — the listing sells one undivided SKU. Add rows for options like Color: Red.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_44px] gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-1">
                <span>Name</span><span>Value</span><span>SKU</span><span>Stock</span><span>Price override</span><span />
              </div>
              {variants.map((variant, index) => (
                <div key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_44px] sm:items-start">
                  <input
                    type="text"
                    aria-label={`Variant ${index + 1} name`}
                    placeholder="e.g., Color"
                    value={variant.variantName}
                    onChange={(e) => {
                      const next = [...variants];
                      next[index] = { ...variant, variantName: e.target.value };
                      onVariantsChange(next);
                    }}
                    className={`${inputClass} sm:min-h-0 sm:py-1.5`}
                  />
                  <input
                    type="text"
                    aria-label={`Variant ${index + 1} value`}
                    placeholder="e.g., Red"
                    value={variant.variantValue}
                    onChange={(e) => {
                      const next = [...variants];
                      next[index] = { ...variant, variantValue: e.target.value };
                      onVariantsChange(next);
                    }}
                    className={`${inputClass} sm:min-h-0 sm:py-1.5`}
                  />
                  <input
                    type="text"
                    aria-label={`Variant ${index + 1} SKU`}
                    placeholder="SKU"
                    value={variant.sku}
                    onChange={(e) => {
                      const next = [...variants];
                      next[index] = { ...variant, sku: e.target.value };
                      onVariantsChange(next);
                    }}
                    className={`${inputClass} sm:min-h-0 sm:py-1.5`}
                  />
                  <input
                    type="number"
                    min="0"
                    step={form.unit === 'kg' ? '0.5' : '1'}
                    aria-label={`Variant ${index + 1} stock`}
                    placeholder="Stock"
                    value={variant.stockQuantity}
                    onChange={(e) => {
                      const next = [...variants];
                      next[index] = { ...variant, stockQuantity: e.target.value };
                      onVariantsChange(next);
                    }}
                    className={`${inputClass} sm:min-h-0 sm:py-1.5`}
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    aria-label={`Variant ${index + 1} price override`}
                    placeholder="Override"
                    value={variant.priceOverride}
                    onChange={(e) => {
                      const next = [...variants];
                      next[index] = { ...variant, priceOverride: e.target.value };
                      onVariantsChange(next);
                    }}
                    className={`${inputClass} sm:min-h-0 sm:py-1.5`}
                  />
                  <button
                    type="button"
                    aria-label={`Remove variant ${index + 1}`}
                    onClick={() => onVariantsChange(variants.filter((_, i) => i !== index))}
                    className="min-h-11 min-w-11 p-2 text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Media — real uploads to /api/uploads/product-media */}
      <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Media</h2>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              id="pf-image-input"
              onChange={(e) => handleImagesSelected(e.target.files)}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="min-h-11 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 hover:bg-gray-50"
            >
              <ImagePlus className="w-4 h-4" /> Add images
            </button>
            <span className="text-xs text-gray-500">PNG, JPG, WebP up to 5MB each — the first image becomes the thumbnail</span>
          </div>

          {images.length === 0 ? (
            <p className="text-xs text-gray-500">No images uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {images.map((img, index) => (
                <div key={`${img.fileName}-${index}`} className="relative group">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {img.status === 'uploading' ? (
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" aria-label={`Uploading ${img.fileName}`} />
                    ) : img.status === 'error' ? (
                      <span className="text-[10px] text-red-600 text-center px-1" title={img.error}>Failed — remove &amp; retry</span>
                    ) : (
                       
                      <img src={img.url} alt={`Product image ${index + 1}`} className="w-full h-full object-cover" />
                    )}
                  </div>
                  {index === 0 && img.status === 'ready' && (
                    <span className="absolute top-1 left-1 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Thumb</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove image ${index + 1}`}
                    onClick={() => onImagesChange(images.filter((_, i) => i !== index))}
                    className="absolute top-1 right-1 min-h-8 min-w-8 p-1.5 bg-white/90 border border-gray-200 rounded-full text-red-500 hover:bg-red-50 flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {img.status === 'error' && img.error && (
                    <p className="text-[10px] text-red-600 mt-1 line-clamp-2">{img.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm"
              className="sr-only"
              id="pf-video-input"
              onChange={(e) => handleVideoSelected(e.target.files)}
            />
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="min-h-11 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 hover:bg-gray-50"
            >
              <VideoIcon className="w-4 h-4" /> Add video
            </button>
            <span className="text-xs text-gray-500">MP4 or WebM up to 50MB</span>
          </div>

          {videos.length === 0 ? (
            <p className="text-xs text-gray-500">No videos uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {videos.map((video, index) => (
                <div key={`${video.fileName}-${index}`} className="flex items-start gap-3 bg-gray-50 p-2 rounded-lg">
                  <div className="w-28 h-16 bg-gray-200 rounded overflow-hidden flex items-center justify-center shrink-0">
                    {video.status === 'ready' ? (
                      <video src={video.url} controls className="w-full h-full object-cover" preload="metadata" />
                    ) : video.status === 'uploading' ? (
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" aria-label={`Uploading ${video.fileName}`} />
                    ) : (
                      <span className="text-[10px] text-red-600 text-center px-1">Failed</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <input
                      type="text"
                      aria-label={`Video ${index + 1} title`}
                      placeholder="Video title (optional)"
                      value={video.title}
                      onChange={(e) => {
                        const next = [...videos];
                        next[index] = { ...video, title: e.target.value };
                        onVideosChange(next);
                      }}
                      className={`${inputClass} min-h-0 py-1.5`}
                    />
                    <p className="text-[11px] text-gray-500 truncate">{video.fileName}</p>
                    {video.error && <p className="text-[10px] text-red-600">{video.error}</p>}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove video ${index + 1}`}
                    onClick={() => onVideosChange(videos.filter((_, i) => i !== index))}
                    className="min-h-11 min-w-11 p-2 text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {uploadingCount > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {uploadingCount} file{uploadingCount === 1 ? '' : 's'} still uploading — wait for uploads to finish before publishing.
        </p>
      )}
    </div>
  );
}
