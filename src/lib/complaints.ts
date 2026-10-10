import type { complaints } from '@prisma/client'

/**
 * Shared complaints types + serializer.
 *
 * Every field below is real DB data — no fabricated complaint numbers (the
 * cuid id IS the identifier), no client-set statuses. The status lifecycle is
 * server-guarded in the API routes (see the complaints model comment):
 *   open → in_review → resolved|rejected, open → withdrawn (owner only).
 */

export const COMPLAINT_CATEGORIES = [
  'order_issue',
  'product_quality',
  'delivery',
  'payment',
  'seller_behavior',
  'other',
] as const

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number]

/** Real display label for a category — unknown real values pass through verbatim. */
export function complaintCategoryLabel(category: string): string {
  switch (category) {
    case 'order_issue': return 'Order issue'
    case 'product_quality': return 'Product quality'
    case 'delivery': return 'Delivery'
    case 'payment': return 'Payment'
    case 'seller_behavior': return 'Seller behavior'
    case 'other': return 'Other'
    default: return category
  }
}

export interface SerializedComplaint {
  id: string
  buyerId: string
  orderId: string | null
  subOrderId: string | null
  category: string
  title: string
  description: string
  status: string
  resolutionNote: string | null
  resolvedById: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export function serializeComplaint(row: complaints): SerializedComplaint {
  return {
    id: row.id,
    buyerId: row.buyerId,
    orderId: row.orderId,
    subOrderId: row.subOrderId,
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    resolutionNote: row.resolutionNote,
    resolvedById: row.resolvedById,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Buyer display context joined for admin views (users has NO name column). */
export interface ComplaintBuyer {
  id: string
  /** From buyerProfiles.fullName — null when the buyer has no profile. */
  name: string | null
  email: string | null
}
