import { z } from 'zod'

/**
 * Task 110: THE PRESS & INVESTOR RAIL (shared contracts). Four public pages
 * (media-kit, investor-relations, financial-filings, annual-report) read
 * mediaKitAssets and investorDocuments — both with zero writers since day
 * one. Standing rule: .strict() on every request schema.
 */

export const MEDIA_ASSET_TYPES = ['logo', 'brand_guideline', 'photography', 'executive_photo', 'product_screenshot', 'press_photo'] as const
export const INVESTOR_DOC_TYPES = ['annual_report', 'quarterly_report', 'financial_filing', 'investor_presentation', 'shareholder_letter'] as const

const urlish = (msg: string) =>
  z.string().trim().min(1, msg).max(500).refine(
    (v) => v.startsWith('https://') || v.startsWith('/uploads/') || v.startsWith('/'),
    { message: 'File URL must be https:// or a /uploads/ path' }
  )

export const mediaAssetSchema = z
  .object({
    assetType: z.enum(MEDIA_ASSET_TYPES),
    title: z.string().trim().min(1, 'Title is required').max(140),
    description: z.string().trim().max(500).optional().nullable(),
    fileUrl: urlish('File URL is required'),
    thumbnailUrl: z.string().trim().max(500).optional().nullable(),
    fileSizeMB: z.number().min(0, 'File size cannot be negative').max(500).optional().nullable(),
    fileFormat: z.string().trim().max(20).optional().nullable(),
    isPublic: z.boolean().optional(),
  })
  .strict()

export const mediaAssetPatchSchema = z
  .object({
    assetType: z.enum(MEDIA_ASSET_TYPES).optional(),
    title: z.string().trim().min(1, 'Title is required').max(140).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    fileUrl: urlish('File URL is required').optional(),
    thumbnailUrl: z.string().trim().max(500).nullable().optional(),
    fileSizeMB: z.number().min(0).max(500).nullable().optional(),
    fileFormat: z.string().trim().max(20).nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .strict()

export const investorDocSchema = z
  .object({
    docType: z.enum(INVESTOR_DOC_TYPES),
    title: z.string().trim().min(1, 'Title is required').max(160),
    fiscalYear: z.string().trim().max(20).optional().nullable(),
    fiscalQ: z.string().trim().max(10).optional().nullable(),
    fileUrl: urlish('File URL is required'),
    summary: z.string().trim().max(1000).optional().nullable(),
    isPublished: z.boolean().optional(),
  })
  .strict()

export const investorDocPatchSchema = z
  .object({
    docType: z.enum(INVESTOR_DOC_TYPES).optional(),
    title: z.string().trim().min(1, 'Title is required').max(160).optional(),
    fiscalYear: z.string().trim().max(20).nullable().optional(),
    fiscalQ: z.string().trim().max(10).nullable().optional(),
    fileUrl: urlish('File URL is required').optional(),
    summary: z.string().trim().max(1000).nullable().optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()

export function shapeMediaAsset(row: {
  id: string; assetType: string; title: string; description: string | null; fileUrl: string
  thumbnailUrl: string | null; fileSizeMB: number | null; fileFormat: string | null
  isPublic: boolean; createdAt: Date
}) {
  return {
    id: row.id, assetType: row.assetType, title: row.title, description: row.description,
    fileUrl: row.fileUrl, thumbnailUrl: row.thumbnailUrl, fileSizeMB: row.fileSizeMB,
    fileFormat: row.fileFormat, isPublic: row.isPublic, createdAt: row.createdAt.toISOString(),
  }
}

export function shapeInvestorDoc(row: {
  id: string; docType: string; title: string; fiscalYear: string | null; fiscalQ: string | null
  fileUrl: string; summary: string | null; isPublished: boolean; publishedAt: Date
}) {
  return {
    id: row.id, docType: row.docType, title: row.title, fiscalYear: row.fiscalYear,
    fiscalQ: row.fiscalQ, fileUrl: row.fileUrl, summary: row.summary, isPublished: row.isPublished,
    publishedAt: row.publishedAt.toISOString(),
  }
}
