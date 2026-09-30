/**
 * Shared helpers for the admin return-requests review queue
 * (GET /api/admin/returns + PATCH /api/admin/returns/[id]).
 *
 * returnRequests / returnRequestItems have PLAIN STRING FKs (no Prisma
 * relations by design), so order + buyer info is joined manually here.
 * Every serialized field is real DB data — null stays null. No fabricated
 * values anywhere.
 */
import type { returnRequests, returnRequestItems } from '@prisma/client'

/** Legal return statuses (mirrors the schema comment). */
export const RETURN_STATUSES = ['pending', 'approved', 'rejected', 'refunded'] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]

export interface AdminReturnOrderInfo {
  orderNumber: string | null
  /** orders has NO status column — derived from subOrders exactly like /api/admin/orders. */
  status: string | null
  paymentStatus: string | null
}

export interface AdminReturnBuyerInfo {
  id: string
  /** users has NO name column — the buyer's real display name lives in buyerProfiles.fullName. */
  name: string | null
  email: string | null
}

export interface SerializedAdminReturn {
  id: string
  returnNumber: string
  orderId: string
  status: string
  shippingMethod: string
  estimatedRefund: number
  resolutionNote: string | null
  resolvedById: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  items: {
    id: string
    orderItemId: string
    reason: string
    quantity: number
    comments: string | null
  }[]
  order: AdminReturnOrderInfo | null
  buyer: AdminReturnBuyerInfo | null
}

/** Raw joined order row shape passed to the serializer. */
export interface AdminReturnOrderRow {
  orderNumber: string
  paymentStatus: string
  subOrders: { status: string | null }[]
}

/** Raw joined buyer row shape (only safe public fields — NEVER passwordHash). */
export interface AdminReturnBuyerRow {
  id: string
  email: string | null
  fullName: string | null
}

/**
 * Order status derivation — EXACT copy of /api/admin/orders so every admin
 * surface reports the same derived truth (orders.status does not exist).
 */
export function deriveOrderStatus(subStatuses: (string | null)[]): string {
  const statuses = subStatuses.map((s) => (s || 'pending').toLowerCase())
  return statuses.length === 0
    ? 'processing'
    : statuses.every((s) => s === 'delivered')
      ? 'delivered'
      : statuses.some((s) => s === 'cancelled')
        ? 'cancelled'
        : statuses.some((s) => s === 'shipped')
          ? 'shipped'
          : 'processing'
}

export function serializeAdminReturn(
  r: returnRequests,
  items: returnRequestItems[],
  order: AdminReturnOrderRow | null,
  buyer: AdminReturnBuyerRow | null
): SerializedAdminReturn {
  return {
    id: r.id,
    returnNumber: r.returnNumber,
    orderId: r.orderId,
    status: r.status,
    shippingMethod: r.shippingMethod,
    estimatedRefund: r.estimatedRefund,
    resolutionNote: r.resolutionNote,
    resolvedById: r.resolvedById,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      orderItemId: i.orderItemId,
      reason: i.reason,
      quantity: i.quantity,
      comments: i.comments,
    })),
    order: order
      ? {
          orderNumber: order.orderNumber,
          status: deriveOrderStatus(order.subOrders.map((s) => s.status)),
          paymentStatus: order.paymentStatus,
        }
      : null,
    buyer: buyer
      ? { id: buyer.id, name: buyer.fullName, email: buyer.email }
      : null,
  }
}
