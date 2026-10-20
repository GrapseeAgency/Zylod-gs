import { z } from 'zod'

/**
 * Task 108: THE DELIVERY-METHODS RAIL (shared contracts). The checkout
 * pages (delivery-method, order-summary) have fetched GET /api/delivery-methods
 * since day one and honestly showed "No delivery methods have been
 * configured yet" — nothing could write a row. This module is the writer's
 * single source of validation: admin-curated courier options with a flat
 * displayed price, an icon the pages actually render (truck | plane |
 * store — anything else would render blank), and an active flag that
 * removes the option from buyers without deleting it.
 *
 * Standing rule (after Tasks 106/107 caught it twice): EVERY request
 * schema carries .strict() — zod v4 strips unknown keys otherwise.
 */

export const DELIVERY_ICONS = ['truck', 'plane', 'store'] as const

export const deliveryMethodSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80),
    description: z.string().trim().max(200).optional().nullable(),
    price: z
      .number()
      .min(0, 'Price cannot be negative')
      .max(100_000, 'Price looks wrong — cap is ৳100,000'),
    estimatedDelivery: z.string().trim().max(60).optional().nullable(),
    badge: z.string().trim().max(40).optional().nullable(),
    icon: z.enum(DELIVERY_ICONS).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict()

export const deliveryMethodPatchSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    description: z.string().trim().max(200).nullable().optional(),
    price: z.number().min(0, 'Price cannot be negative').max(100_000, 'Price looks wrong — cap is ৳100,000').optional(),
    estimatedDelivery: z.string().trim().max(60).nullable().optional(),
    badge: z.string().trim().max(40).nullable().optional(),
    icon: z.enum(DELIVERY_ICONS).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict()

export function shapeAdminDeliveryMethod(row: {
  id: string
  name: string
  description: string | null
  price: number
  estimatedDelivery: string | null
  badge: string | null
  icon: string
  isActive: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    estimatedDelivery: row.estimatedDelivery,
    badge: row.badge,
    icon: row.icon,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
