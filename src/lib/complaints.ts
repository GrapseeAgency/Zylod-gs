import type { complaints } from '@prisma/client'
import { db } from '@/lib/db'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { sendNotification } from '@/lib/notifications'

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

// ── Task 86 — the dispute surface's cohesion rails ─────────────────────────
// A filed complaint must REACH the humans who act on it, and the filer must
// HEAR every decision. Both directions ride the platform's two existing
// rails — durable notifications rows (the bell) and live pushes
// (sendNotification broadcasts 'notification:new' into the recipient's
// private user:<id> room; admins additionally get a 'complaint:new' tap on
// their admin:<id> room so an open review queue refreshes itself).
// Every helper is best-effort BY DESIGN: the complaint row is already
// persisted; a notification failure must never fail the API call.

/** Minimal real shape of a freshly created complaints row (full Prisma rows satisfy this). */
export interface ComplaintNoticeInput {
  id: string
  buyerId: string
  title: string
  category: string
  orderId: string | null
  subOrderId: string | null
}

/** Fired by POST /api/complaints after the row is persisted. */
export async function notifyComplaintFiled(
  complaint: ComplaintNoticeInput,
  ctx: { orderNumber?: string | null } = {}
): Promise<void> {
  try {
    const categoryLabel = complaintCategoryLabel(complaint.category)
    const orderSuffix = ctx.orderNumber ? ` Order ${ctx.orderNumber}.` : ''

    const admins = await db.users.findMany({
      where: { userType: 'admin' },
      select: { id: true },
    })
    await Promise.all([
      ...admins.map((a) =>
        sendNotification({
          userId: a.id,
          type: 'system',
          title: 'New complaint filed',
          body: `A buyer filed a ${categoryLabel.toLowerCase()} complaint: “${complaint.title}”.${orderSuffix}`,
          relatedEntityId: complaint.id,
        })
      ),
      // Live tap so an open admin review queue refreshes without polling luck
      // (consumed by admin-complaints-page via useRealtimeRoom).
      ...admins.map((a) =>
        broadcastToRoom(`admin:${a.id}`, 'complaint:new', {
          complaintId: complaint.id,
          title: complaint.title,
          category: complaint.category,
          categoryLabel,
          orderNumber: ctx.orderNumber ?? null,
        })
      ),
    ])

    // Sellers implicated through the named order: every supplier with a
    // sub-order on it hears about the complaint against their shipment.
    // subOrders.supplierId is a supplierProfiles id — the notification needs
    // the profile's userId (users.id), exactly the Task-82 id-space join.
    if (complaint.orderId) {
      const subs = await db.subOrders.findMany({
        where: { orderId: complaint.orderId },
        select: { supplierId: true },
        distinct: ['supplierId'],
      })
      const supplierIds = subs.map((s) => s.supplierId).filter(Boolean)
      if (supplierIds.length > 0) {
        const profiles = await db.supplierProfiles.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, userId: true, companyName: true },
        })
        await Promise.all(
          profiles.map((p) =>
            sendNotification({
              userId: p.userId,
              type: 'system',
              title: 'Complaint filed on your order',
              body: `A buyer filed a ${categoryLabel.toLowerCase()} complaint${
                ctx.orderNumber ? ` on order ${ctx.orderNumber}` : ''
              }: “${complaint.title}”. The Zylod team will review it and contact you if your input is needed.`,
              relatedEntityId: complaint.id,
            })
          )
        )
      }
    }
  } catch (error) {
    console.error('notifyComplaintFiled error:', error)
  }
}

/** Fired by PATCH /api/admin/complaints/[id] after a guarded transition. */
export async function notifyComplaintDecided(
  complaint: ComplaintNoticeInput & { resolutionNote?: string | null },
  action: 'start_review' | 'resolve' | 'reject'
): Promise<void> {
  try {
    const payload: Parameters<typeof sendNotification>[0] = {
      userId: complaint.buyerId,
      type: 'system',
      title: '',
      body: '',
      relatedEntityId: complaint.id,
    }
    if (action === 'start_review') {
      payload.title = 'Your complaint is being reviewed'
      payload.body = `“${complaint.title}” has moved into review by the Zylod team. Evidence is now locked — the decision will appear here.`
    } else if (action === 'resolve') {
      payload.title = 'Complaint resolved'
      payload.body = `“${complaint.title}” was reviewed and resolved. Note from the team: ${complaint.resolutionNote ?? ''}`
    } else {
      payload.title = 'Complaint rejected'
      payload.body = `“${complaint.title}” was reviewed and rejected. Note from the team: ${complaint.resolutionNote ?? ''}`
    }
    await sendNotification(payload)
  } catch (error) {
    console.error('notifyComplaintDecided error:', error)
  }
}
