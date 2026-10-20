import { z } from 'zod'

/**
 * Task 106: THE COMPANY CONTENT RAIL (shared contracts).
 * Two admin-written, public-read rails whose readers existed from day one
 * but whose writers did not — the platform's own voice (legal documents and
 * the company milestone timeline) could never be published. This module
 * holds the single source of truth for validation and shaping.
 */

/** The nine legal slots the public pages fetch by docType slug. */
export const LEGAL_DOC_TYPES = [
  'terms_of_service',
  'privacy_policy',
  'return_policy',
  'shipping_policy',
  'payment_terms',
  'wholesale_terms',
  'cookie_policy',
  'dmca_policy',
  'refund_policy',
] as const

export type LegalDocType = (typeof LEGAL_DOC_TYPES)[number]

export const LEGAL_DOC_LABELS: Record<LegalDocType, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  return_policy: 'Return Policy',
  shipping_policy: 'Shipping Policy',
  payment_terms: 'Payment Terms',
  wholesale_terms: 'Wholesale Terms',
  cookie_policy: 'Cookie Policy',
  dmca_policy: 'DMCA Policy',
  refund_policy: 'Refund Policy',
}

export const MILESTONE_ICON_TYPES = [
  'star',
  'rocket',
  'users',
  'package',
  'globe',
  'award',
  'building',
  'trending',
] as const

/**
 * PUT /api/admin/legal/[docType] — create-or-update by docType.
 * docType is @unique: one row per slot, so the write path is an honest
 * upsert (the same row id survives a re-edit — never create+delete churn).
 * effectiveDate is the day the text becomes binding; the admin stamps it.
 * NO defaults on the shared schema — PATCH-less design, but the same
 * zod-v4 lesson holds: every key here is explicit in the PUT body.
 */
export const legalDocSchema = z.object({
  titleEn: z.string().trim().min(1, 'English title is required').max(160),
  titleBn: z.string().trim().max(160).optional().nullable(),
  contentEn: z.string().trim().min(1, 'English content is required').max(120_000),
  contentBn: z.string().trim().max(120_000).optional().nullable(),
  version: z.string().trim().min(1, 'Version is required (e.g. 1.0)').max(24),
  effectiveDate: z.string().datetime({ offset: true, message: 'effectiveDate must be an ISO datetime' }).optional(),
  isActive: z.boolean(),
}).strict()

export type LegalDocInput = z.infer<typeof legalDocSchema>

/** What the admin list serves — full rows are admin-only; the public rail shapes its own. */
export function shapeAdminLegal(row: {
  id: string
  docType: string
  titleEn: string
  titleBn: string | null
  contentEn: string
  contentBn: string | null
  version: string
  effectiveDate: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    docType: row.docType,
    titleEn: row.titleEn,
    titleBn: row.titleBn,
    contentEn: row.contentEn,
    contentBn: row.contentBn,
    version: row.version,
    effectiveDate: row.effectiveDate.toISOString(),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * POST /api/admin/milestones. year is bounded to a sane founding-future
 * window; month 1..12 or absent; iconType is one of the eight glyphs the
 * timeline page actually renders (invented values would render blank chips).
 */
export const milestoneSchema = z.object({
  year: z
    .number()
    .int('Year must be a whole number')
    .min(1990, 'Year cannot be before 1990')
    .max(2100, 'Year cannot be after 2100'),
  month: z
    .number()
    .int('Month must be a whole number')
    .min(1, 'Month is 1–12')
    .max(12, 'Month is 1–12')
    .optional()
    .nullable(),
  title: z.string().trim().min(1, 'Title is required').max(140),
  description: z.string().trim().min(1, 'Description is required').max(2000),
  iconType: z.enum(MILESTONE_ICON_TYPES).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isPublished: z.boolean().optional(),
}).strict()

/** PATCH touches only the keys that arrived (zod-v4 lesson: no defaults here). */
export const milestonePatchSchema = z.object({
  year: z.number().int().min(1990).max(2100).optional(),
  month: z.number().int().min(1).max(12).nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(140).optional(),
  description: z.string().trim().min(1, 'Description is required').max(2000).optional(),
  iconType: z.enum(MILESTONE_ICON_TYPES).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isPublished: z.boolean().optional(),
}).strict()

export function shapeAdminMilestone(row: {
  id: string
  year: number
  month: number | null
  title: string
  description: string
  iconType: string | null
  sortOrder: number
  isPublished: boolean
  createdAt: Date
}) {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    title: row.title,
    description: row.description,
    iconType: row.iconType,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    createdAt: row.createdAt.toISOString(),
  }
}
