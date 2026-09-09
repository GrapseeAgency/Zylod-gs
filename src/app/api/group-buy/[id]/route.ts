import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { id } = await params

    const body = await request.json()
    const quantity = Math.max(1, Number(body.quantity || 1))

    const campaign = await db.groupBuyCampaigns.findUnique({
      where: { id },
    })

    if (!campaign || campaign.status !== 'active') {
      return NextResponse.json({ error: 'Campaign not found or no longer active' }, { status: 404 })
    }

    if (new Date(campaign.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This group buy campaign has ended' }, { status: 400 })
    }

    // Record participant
    const participant = await db.groupBuyParticipants.create({
      data: {
        campaignId: id,
        userId: auth.user.id,
        quantity,
        status: 'joined',
      },
    })

    // Increment current quantity
    const updated = await db.groupBuyCampaigns.update({
      where: { id },
      data: {
        currentQty: { increment: quantity },
      },
    })

    // If target achieved, mark completed!
    if (updated.currentQty >= updated.targetQty) {
      await db.groupBuyCampaigns.update({
        where: { id },
        data: { status: 'completed' },
      })
    }

    // Real in-app notification
    await sendNotification({
      userId: auth.user.id,
      type: 'order',
      title: `Joined Group Buy: ${campaign.title}`,
      body: `You reserved ${quantity} units at the volume rate of ৳${campaign.discountedPrice.toLocaleString()} (Saving ${Math.round(((campaign.originalPrice - campaign.discountedPrice) / campaign.originalPrice) * 100)}%).`,
      relatedEntityId: campaign.id,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully joined group buy pool for ${quantity} units!`,
      data: { participant, newTotalQty: updated.currentQty },
    }, { status: 201 })
  } catch (error) {
    console.error('Group buy join POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
