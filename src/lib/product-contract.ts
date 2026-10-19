/**
 * Canonical supplier product contract (Task 50-a).
 *
 * This is the SINGLE source of truth for the product payload exchanged between
 * the seller product pages and the supplier product APIs:
 *   POST   /api/supplier/products      (create)
 *   PATCH  /api/supplier/products/[id] (full replace)
 *
 * Agent 50-b (orders/cart) implements the PRICING RULE documented at the
 * bottom of this file and can import the schemas/helpers from here — do not
 * duplicate or drift from this contract.
 *
 * REAL schema mapping (prisma/schema.prisma):
 *   products.productPriceTiers → productPriceTiers { minQty, maxQty?, pricePerUnit }
 *   products.images            → productImages    { imageUrl, sortOrder }
 *   products.videos            → productVideos    { videoUrl, title?, sortOrder }
 *   products.variants          → productVariants  { variantName, variantValue, sku?, stockQuantity, priceOverride? }
 *   products.unit              → EXACTLY 'pcs' | 'dozen' | 'kg' | 'carton' | 'box' | 'set' | 'bundle'
 *   products.bundleSize        → Float? — how many base units ONE purchasable bundle contains
 *                                 (e.g. bundleSize 50 + unit pcs = "bundle of 50 pcs"; per-unit
 *                                 kom-dam price = price / bundleSize). Null/undefined = plain
 *                                 single units. DISPLAY DEPTH ONLY — the price stays PER BUNDLE;
 *                                 tiers/moq/stock/quantity keep their existing semantics.
 *   products.currency          → 'BDT' (schema default; wholesale marketplace is BDT-only)
 *
 * Tier rules (enforced here and mirrored server-side):
 *   - pricePerUnit ≤ basePrice (wholesale discount tiers never exceed list price)
 *   - minQty strictly increasing across tiers, no qty-range overlap
 *   - at most ONE open-ended tier (maxQty null) and it must be the last tier
 */
import { z } from 'zod'

/** The exact unit values stored in products.unit (schema comment). */
export const PRODUCT_UNITS = ['pcs', 'dozen', 'kg', 'carton', 'box', 'set', 'bundle'] as const

export type ProductUnit = (typeof PRODUCT_UNITS)[number]

/** Friendly labels for the unit enum — UI shows these, submits the schema value. */
export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  pcs: 'Pieces (pcs)',
  dozen: 'Dozen',
  kg: 'Kilograms (kg)',
  carton: 'Carton',
  box: 'Box',
  set: 'Set',
  bundle: 'Bundle (units per bundle)',
}

/**
 * Bundle size (Task 55-c): optional positive decimal ≤ 100,000, normalized to
 * 2 decimal places via roundQty so float drift never reaches the DB. When the
 * seller leaves it empty the payload carries null — plain single units.
 */
export const bundleSizeSchema = z
  .number()
  .positive('Bundle size must be greater than 0')
  .max(100000, 'Bundle size cannot exceed 100,000')
  .nullable()
  .optional()
  .transform((v) => (v == null ? null : roundQty(v)))

export const priceTierSchema = z.object({
  minQty: z.number().positive('Minimum quantity must be greater than 0'),
  maxQty: z
    .number()
    .positive('Maximum quantity must be greater than 0')
    .nullable()
    .optional(),
  pricePerUnit: z.number().positive('Tier price must be greater than 0'),
})

export const productImageSchema = z.object({
  imageUrl: z.string().min(1, 'Image URL is required'),
  sortOrder: z.number().int().min(0, 'Sort order must be 0 or greater'),
})

export const productVideoSchema = z.object({
  // Task 67-b: the SAME contract the attach route enforces — a row may carry
  // either an uploaded /uploads/videos/ path or an external https:// link.
  // The payload path (product create / PATCH full-replace) used to accept any
  // string, so a URL the delete route treats as local-storage or the PDP
  // can't play could slip in behind the attach route's back.
  url: z
    .string()
    .trim()
    .min(1, 'Video URL is required')
    .max(500, 'Video URL must be 500 characters or fewer')
    .refine(
      (v) => v.startsWith('/uploads/videos/') || v.startsWith('https://'),
      'Video URL must start with /uploads/videos/ or be an https:// URL'
    ),
  title: z.string().trim().max(140, 'Title must be 140 characters or fewer').optional(),
})

export const productVariantSchema = z.object({
  variantName: z.string().trim().min(1, 'Variant name is required (e.g. "Color")'),
  variantValue: z.string().trim().min(1, 'Variant value is required (e.g. "Red")'),
  sku: z.string().trim().max(100).optional(),
  stockQuantity: z.number().min(0, 'Variant stock cannot be negative'),
  priceOverride: z
    .number()
    .positive('Price override must be greater than 0')
    .nullable()
    .optional(),
})

export const productPayloadSchema = z
  .object({
    name: z.string().trim().min(1, 'Product name is required').max(200),
    categoryId: z.string().min(1, 'Category is required'),
    description: z
      .string()
      .trim()
      .min(1, 'Description is required')
      .max(10000, 'Description must be 10,000 characters or fewer'),
    brand: z.string().trim().max(100).optional(),
    sku: z.string().trim().max(100).optional(),
    unit: z.enum(PRODUCT_UNITS, { message: 'Unit must be one of: pcs, dozen, kg, carton, box, set, bundle' }),
    bundleSize: bundleSizeSchema,
    moq: z.number().positive('MOQ must be greater than 0'),
    maxOrderQty: z.number().positive().nullable().optional(),
    basePrice: z.number().positive('Base price must be greater than 0'),
    currency: z.literal('BDT').default('BDT'),
    stockQuantity: z.number().min(0, 'Stock cannot be negative'),
    // Seller-tuned PDP low-stock urgency threshold (Task 57-b). Null/omitted
    // = platform default (5). Must be ≥ 0 when supplied.
    stockAlertThreshold: z.number().min(0, 'Low-stock threshold cannot be negative').nullable().optional(),
    isCustomizable: z.boolean().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    images: z.array(productImageSchema),
    videos: z.array(productVideoSchema).optional(),
    variants: z.array(productVariantSchema).optional(),
    priceTiers: z.array(priceTierSchema),
  })
  .superRefine((payload, ctx) => {
    // 1. Every tier is a wholesale discount: pricePerUnit ≤ basePrice.
    payload.priceTiers.forEach((tier, index) => {
      if (tier.pricePerUnit > payload.basePrice) {
        ctx.addIssue({
          code: 'custom',
          message: `Tier ${index + 1}: tier price must be ≤ the base price (wholesale discount)`,
          path: ['priceTiers', index, 'pricePerUnit'],
        })
      }
      if (tier.maxQty != null && tier.maxQty < tier.minQty) {
        ctx.addIssue({
          code: 'custom',
          message: `Tier ${index + 1}: max quantity must be ≥ min quantity`,
          path: ['priceTiers', index, 'maxQty'],
        })
      }
    })

    // 2. minQty strictly increasing, no overlap, single trailing open tier.
    const sorted = [...payload.priceTiers].sort((a, b) => a.minQty - b.minQty)
    sorted.forEach((tier, i) => {
      if (i === 0) return
      const prev = sorted[i - 1]
      if (tier.minQty <= prev.minQty) {
        ctx.addIssue({
          code: 'custom',
          message: `Tier starting at ${tier.minQty}: min quantities must strictly increase`,
          path: ['priceTiers', payload.priceTiers.indexOf(tier), 'minQty'],
        })
      }
      if (prev.maxQty != null && tier.minQty <= prev.maxQty) {
        ctx.addIssue({
          code: 'custom',
          message: `Tier starting at ${tier.minQty}: quantity ranges overlap with the tier ending at ${prev.maxQty}`,
          path: ['priceTiers', payload.priceTiers.indexOf(tier), 'minQty'],
        })
      }
      if (prev.maxQty == null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Only the LAST tier may be open-ended (empty max quantity)',
          path: ['priceTiers', payload.priceTiers.indexOf(prev), 'maxQty'],
        })
      }
    })
  })

export type ProductPayload = z.infer<typeof productPayloadSchema>

/**
 * PRICING RULE (reference for the orders/cart agent 50-b — NOT enforced here):
 *
 *   unitPrice =
 *     variant.priceOverride                                  (when the cart line targets a variant with an override)
 *     else the priceTiers row whose [minQty, maxQty] covers the order qty
 *     else basePrice
 *
 * Tiers are validated to be non-overlapping and increasing, so at most one
 * tier can cover any given quantity. A closed last tier leaves quantities
 * above maxQty falling back to basePrice? No — an open-ended (null maxQty)
 * LAST tier covers everything at or above its minQty; when the last tier is
 * closed, quantities above its maxQty fall back to basePrice.
 */
export function resolveTierUnitPrice(
  quantity: number,
  tiers: Array<{ minQty: number; maxQty?: number | null; pricePerUnit: number }>,
  basePrice: number
): number {
  const covering = tiers.find(
    (t) => quantity >= t.minQty && (t.maxQty == null || quantity <= t.maxQty)
  )
  return covering ? covering.pricePerUnit : basePrice
}

/**
 * Quantities are unit-bearing decimals (kg: 2.5 kg is a valid order line).
 * Round every stored/served quantity to 2 decimal places to avoid
 * float drift (0.30000000000000004) leaking into DB rows and API payloads.
 */
export function roundQty(n: number): number {
  return Math.round(n * 100) / 100
}

/** Build a URL-safe slug from a product name (products.slug is required, non-unique in schema). */
export function slugifyProductName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 120) || 'product'
  )
}
