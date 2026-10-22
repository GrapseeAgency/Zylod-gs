import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { z } from 'zod'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'

/**
 * GET /api/group-buy/[id]
 * Get campaign details and participants list.
 *
 * POST /api/group-buy/[id]
 * Join this group buy campaign with a specified quantity.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const campaign = await db.groupBuyCampaigns.findUnique({
      where: { id },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Group buy campaign not found' }, { status: 404 })
    }

    const [product, participants] = await Promise.all([
      db.products.findUnique({
        where: { id: campaign.productId },
        select: { id: true, name: true, thumbnailUrl: true, basePrice: true, description: true },
      }),
      db.groupBuyParticipants.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    const userIds = participants.map(p => p.userId)
    const users = userIds.length > 0
      ? await db.users.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : []
    const userMap = new Map(users.map(u => [u.id, u.email]))

    const formattedParticipants = participants.map(p => ({
      id: p.id,
      userId: p.userId,
      userEmailMasked: (userMap.get(p.userId) || 'buyer***').replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      quantity: p.quantity,
      status: p.status,
      joinedAt: p.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        ...campaign,
        product,
        participants: formattedParticipants,
        totalParticipants: participants.length,
        progressPercent: Math.min(100, Math.round((campaign.currentQty / campaign.targetQty) * 100)),
      },
    })
  } catch (error) {
    console.error('Group buy GET [id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const JoinSchema = z
  .object({ quantity: z.coerce.number().positive('Quantity must be positive').max(100_000) })
  .strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'group-buy-join', 10, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = JoinSchema.safeParse(body ?? {})
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    const quantity = parsed.data.quantity
    const userId = auth.user.id

    const campaign = await db.groupBuyCampaigns.findUnique({ where: { id } })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.status === 'completed') {
      // Task 141: a filled pool is not "not found" — it is FULL, and the
      // response states the real numbers.
      return NextResponse.json(
        { error: `This pool has already filled — ${Math.round(campaign.currentQty)} of ${Math.round(campaign.targetQty)} units reserved` },
        { status: 409 }
      )
    }
    if (campaign.status !== 'active') {
      return NextResponse.json({ error: 'Campaign not found or no longer active' }, { status: 404 })
    }
    if (new Date(campaign.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This group buy campaign has ended' }, { status: 410 })
    }

    // Task 141: reservation is now ATOMIC and cannot over-promise. The
    // participant row (found-or-created — re-joining tops up the SAME row so
    // redemption math stays one-record-per-buyer) and the pool counter move
    // inside ONE transaction; a join that would push the pool past its
    // target is refused 409 with the REAL remaining units, never silently
    // overbooked by a race.
    const result = await db.$transaction(async (tx) => {
      const fresh = await tx.groupBuyCampaigns.findUnique({ where: { id } })
      if (!fresh) {
        return { conflict: 'Campaign not found', code: 404 as const }
      }
      if (fresh.status === 'completed') {
        return { conflict: `This pool has already filled — ${Math.round(fresh.currentQty)} of ${Math.round(fresh.targetQty)} units reserved`, code: 409 as const }
      }
      if (fresh.status !== 'active') {
        return { conflict: 'Campaign not found or no longer active', code: 404 as const }
      }
      if (new Date(fresh.expiresAt) < new Date()) {
        return { conflict: 'This group buy campaign has ended', code: 410 as const }
      }
      const remaining = fresh.targetQty - fresh.currentQty
      if (quantity > remaining) {
        return { conflict: `Only ${Math.max(0, Math.round(remaining))} units remain in this pool (you asked for ${Math.round(quantity)})`, code: 409 as const }
      }

      const participant = await tx.groupBuyParticipants.upsert({
        where: { campaignId_userId: { campaignId: id, userId } },
        create: { campaignId: id, userId, quantity, status: 'joined' },
        update: { quantity: { increment: quantity } },
      })

      const updated = await tx.groupBuyCampaigns.update({
        where: { id },
        data: { currentQty: { increment: quantity } },
      })

      // Pool filled → the promise becomes real. Flip once; every participant
      // (this one included) is told their pool rate is now orderable.
      if (updated.currentQty >= updated.targetQty && fresh.status === 'active') {
        await tx.groupBuyCampaigns.update({ where: { id }, data: { status: 'completed' } })
        return { participant, updated, completed: true as const }
      }
      return { participant, updated, completed: false as const }
    })

    if ('conflict' in result) {
      return NextResponse.json({ error: result.conflict }, { status: result.code ?? 409 })
    }

    // Real in-app notification — now a TRUE statement: the pool rate is
    // honored by the order engine up to the reserved quantity.
    await sendNotification({
      userId,
      type: 'order',
      title: result.completed ? `Pool filled: ${campaign.title}` : `Joined Group Buy: ${campaign.title}`,
      body: result.completed
        ? `The pool reached its target. Your ${Math.round(result.participant.quantity)} reserved units are locked at ৳${campaign.discountedPrice.toLocaleString()} each (regular ৳${campaign.originalPrice.toLocaleString()}) — order them from this product whenever you are ready.`
        : `You reserved ${Math.round(quantity)} units at the volume rate of ৳${campaign.discountedPrice.toLocaleString()} (Saving ${Math.round(((campaign.originalPrice - campaign.discountedPrice) / campaign.originalPrice) * 100)}%).`,
      relatedEntityId: campaign.id,
    })

    // Task 141: when the pool fills, EVERY participant's reservation becomes
    // a real pricing commitment — each is told, and the product's supplier
    // sees the pool they just won (real rows, no fabrication).
    if (result.completed) {
      void (async () => {
        try {
          const others = await db.groupBuyParticipants.findMany({
            where: { campaignId: id, userId: { not: userId } },
            select: { userId: true, quantity: true },
          })
          for (const p of others) {
            await sendNotification({
              userId: p.userId,
              type: 'order',
              title: `Pool filled: ${campaign.title}`,
              body: `The pool reached its target. Your ${Math.round(p.quantity)} reserved units are locked at ৳${campaign.discountedPrice.toLocaleString()} each (regular ৳${campaign.originalPrice.toLocaleString()}) — order them from this product whenever you are ready.`,
              relatedEntityId: campaign.id,
            })
          }
          const productRow = await db.products.findUnique({
            where: { id: campaign.productId },
            select: { supplierId: true },
          })
          const profileRow = productRow
            ? await db.supplierProfiles.findUnique({ where: { id: productRow.supplierId }, select: { userId: true } })
            : null
          if (profileRow?.userId) {
            await sendNotification({
              userId: profileRow.userId,
              type: 'order',
              title: `Group pool filled: ${campaign.title}`,
              body: `${Math.round(result.updated.currentQty)} units pooled at ৳${campaign.discountedPrice.toLocaleString()} by ${others.length + 1} merchant(s). Participants can now order at the pool rate.`,
              relatedEntityId: campaign.id,
            })
          }
        } catch (e) {
          console.error('Pool-completion notification error:', e)
        }
      })()
    }

    return NextResponse.json({
      success: true,
      message: `Successfully joined group buy pool for ${Math.round(quantity)} units!`,
      data: { participant: result.participant, newTotalQty: result.updated.currentQty, poolCompleted: result.completed },
    }, { status: 201 })
  } catch (error) {
    console.error('Group buy join POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
