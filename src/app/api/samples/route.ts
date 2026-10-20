import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { buildAddressSnapshot, parseAddressSnapshot } from '@/lib/addresses'
import { sendNotification } from '@/lib/notifications'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * THE SAMPLE-ORDER RAIL (Task 90) — "try one before the bulk carton".
 * The sampleOrders table existed in the schema from day one with NO route,
 * NO writer, NO reader, and NO UI. This is the buyer side:
 *
 * POST /api/samples — request a sample of a REAL, visible product:
 *   - 401-first, then 'samples-create' 10/min.
 *   - The product must exist AND be visible (isActive + isApproved); its OWN
 *     supplierProfiles row is resolved server-side — a client-sent supplierId
 *     is impossible by construction (the anti-manipulation rule orders use).
 *   - One ACTIVE sample (requested|shipped) per buyer per product → 409;
 *     a delivered or cancelled sample frees the buyer to ask again.
 *   - shippingAddressId, when given, must be the buyer's OWN row (400 like
 *     checkout) and is snapshotted into the sample row AT CREATION — the
 *     Task 87 lesson replayed: addresses are user-deletable and this FK is
 *     SetNull, so the sample's real shipping history must live in the row.
 *   - The supplier is TOLD: a durable notifications row (preferences-checked,
 *     live 'notification:new' push on their user room via sendNotification)
 *     PLUS a live 'sample:new' tap on the seller:<supplierProfileId> room.
 *
 * GET /api/samples — the buyer's own samples, newest first, product +
 * supplier embedded, shipping address served from the live row while it
 * exists and honestly flagged fromSnapshot:true afterwards (never invented).
 */

const SampleCreateSchema = z
  .object({
    productId: z.string().trim().min(1).max(64),
    quantity: z.number().min(1).max(100).default(1),
    shippingAddressId: z.string().trim().min(1).max(64).optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'samples-create', 10, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => null)
    const parsed = SampleCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid sample request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { productId, quantity, shippingAddressId } = parsed.data

    const product = await db.products.findFirst({
      where: { id: productId, isActive: true, isApproved: true },
      select: {
        id: true,
        name: true,
        supplierId: true,
        supplier: { select: { id: true, userId: true, companyName: true } },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (!product.supplier) {
      return NextResponse.json({ error: 'This product has no supplier to ship a sample' }, { status: 409 })
    }

    let addressSnapshot: string | null = null
    if (shippingAddressId) {
      const address = await db.addresses.findFirst({
        where: { id: shippingAddressId, userId: auth.user.id },
      })
      if (!address) {
        return NextResponse.json({ error: 'Invalid shipping address' }, { status: 400 })
      }
      addressSnapshot = buildAddressSnapshot(address)
    }

    const activeDuplicate = await db.sampleOrders.findFirst({
      where: { buyerId: auth.user.id, productId, status: { in: ['requested', 'shipped'] } },
      select: { id: true },
    })
    if (activeDuplicate) {
      return NextResponse.json(
        { error: 'You already have an active sample of this product', sampleId: activeDuplicate.id },
        { status: 409 }
      )
    }

    const buyerProfile = await db.buyerProfiles.findUnique({
      where: { userId: auth.user.id },
      select: { fullName: true },
    })

    const sample = await db.sampleOrders.create({
      data: {
        buyerId: auth.user.id,
        supplierId: product.supplierId,
        productId,
        quantity,
        status: 'requested',
        samplePrice: 0,
        shippingAddressId: shippingAddressId ?? null,
        shippingAddressSnapshot: addressSnapshot,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'sample_requested',
        entityType: 'sampleOrders',
        entityId: sample.id,
        metadata: JSON.stringify({ productId, supplierId: product.supplierId, quantity }),
      },
    })

    // The supplier is TOLD — durable (prefs-checked) + live user-room push:
    await sendNotification({
      userId: product.supplier.userId,
      type: 'order',
      title: `Sample request: ${product.name} ×${quantity}`,
      body: `${buyerProfile?.fullName || 'A buyer'} requested a sample${addressSnapshot ? ' — shipping address attached' : ' — no address provided yet'}.`,
      relatedEntityId: sample.id,
    })
    // PLUS the seller console's live tap (fire-and-forget; DB row is truth).
    void broadcastToRoom(`seller:${product.supplier.id}`, 'sample:new', {
      sampleId: sample.id,
      productId,
      productName: product.name,
      quantity,
    })

    return NextResponse.json(
      { success: true, data: { sampleId: sample.id, status: sample.status } },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST /api/samples error:', err)
    return NextResponse.json({ error: 'Failed to request sample' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'samples-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const rows = await db.sampleOrders.findMany({
      where: { buyerId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            thumbnailUrl: true,
            unit: true,
            supplier: { select: { id: true, companyName: true } },
          },
        },
      },
    })

    // Live-address preference: serve the address book row while it exists,
    // else the immutable snapshot, honestly flagged (Task 87's read shape).
    const addressIds = rows.map((r) => r.shippingAddressId).filter((x): x is string => Boolean(x))
    const liveAddresses = addressIds.length
      ? await db.addresses.findMany({ where: { id: { in: addressIds } } })
      : []
    const addressById = new Map(liveAddresses.map((a) => [a.id, a]))

    const samples = rows.map((s) => {
      const liveAddr = s.shippingAddressId ? addressById.get(s.shippingAddressId) : undefined
      const snapshot = parseAddressSnapshot(s.shippingAddressSnapshot)
      return {
        id: s.id,
        quantity: s.quantity,
        status: s.status,
        samplePrice: s.samplePrice,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        product: s.product
          ? {
              id: s.product.id,
              name: s.product.name,
              slug: s.product.slug,
              thumbnail: s.product.thumbnailUrl,
              unit: s.product.unit,
              supplierName: s.product.supplier?.companyName ?? null,
            }
          : null,
        shippingAddress: liveAddr
          ? {
              live: true,
              label: liveAddr.label,
              contactName: liveAddr.contactName,
              contactPhone: liveAddr.contactPhone,
              addressLine1: liveAddr.addressLine1,
              addressLine2: liveAddr.addressLine2,
              city: liveAddr.city,
              postalCode: liveAddr.postalCode,
            }
          : snapshot
            ? { live: false, ...snapshot }
            : null,
        fromSnapshot: !liveAddr && Boolean(snapshot),
      }
    })

    return NextResponse.json({ success: true, data: { samples } })
  } catch (err) {
    console.error('GET /api/samples error:', err)
    return NextResponse.json({ error: 'Failed to load samples' }, { status: 500 })
  }
}
