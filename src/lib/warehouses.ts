import { z } from 'zod'
import { db } from '@/lib/db'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * Task 98: THE WAREHOUSE RAIL — shared helpers (route files export nothing
 * beyond HTTP handlers). A supplier lists their real ship-from locations;
 * buyers read them from the storefront. The cap mirrors the certification
 * doctrine: a wall of locations is a trust smell, not a feature.
 */

export const WAREHOUSE_CAP = 8

export const warehouseSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    addressLine1: z.string().trim().min(2).max(160),
    addressLine2: z.string().trim().max(160).optional().nullable(),
    city: z.string().trim().min(2).max(60),
    district: z.string().trim().min(2).max(60),
    lat: z.number().min(-90).max(90).optional().nullable(),
    lng: z.number().min(-180).max(180).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict()

/** Row shape served to the OWNER (management views). */
export function shapeOwner(w: {
  id: string
  name: string
  addressLine1: string
  addressLine2: string | null
  city: string
  district: string
  lat: number | null
  lng: number | null
  isActive: boolean
  createdAt: Date
}) {
  return { ...w }
}

/** PUBLIC shape — what a storefront visitor sees. No timestamps, no internals. */
export function shapePublic(w: {
  id: string
  name: string
  addressLine1: string
  addressLine2: string | null
  city: string
  district: string
  lat: number | null
  lng: number | null
}) {
  return {
    id: w.id,
    name: w.name,
    addressLine1: w.addressLine1,
    addressLine2: w.addressLine2,
    city: w.city,
    district: w.district,
    lat: w.lat,
    lng: w.lng,
  }
}

/** Fire-and-forget live tap to every admin room — never blocks the mutation. */
export async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {}
}
