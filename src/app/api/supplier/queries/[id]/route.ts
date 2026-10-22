import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/* Ownership scoping (Task 50-b): every method resolves the session's
 * supplierProfile and only touches rows where supplierId matches. A foreign
 * or unknown id gets the same 404 — no existence leak. */

const QUERY_STATUSES = ['open', 'replied', 'resolved', 'closed'] as const

const patchQuerySchema = z.object({
  replyMessage: z.string().trim().min(1, 'Reply message cannot be empty').max(2000).optional(),
  status: z.enum(QUERY_STATUSES).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const { id } = await params
    // NOTE: sellerCustomerQueries has NO Prisma relation to users/products
    // (only plain FK strings) — buyer + product names resolved explicitly.
    const query = await db.sellerCustomerQueries.findFirst({
      where: { id, supplierId: profile.id },
    })
    if (!query) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 })
    }

    const [buyer, product] = await Promise.all([
      db.users.findUnique({
        where: { id: query.buyerId },
        select: { buyerProfile: { select: { fullName: true, businessName: true } } },
      }),
      query.productId
        ? db.products.findUnique({ where: { id: query.productId }, select: { id: true, name: true } })
        : Promise.resolve(null),
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...query,
        buyerName:
          buyer?.buyerProfile?.businessName ||
          buyer?.buyerProfile?.fullName ||
          'Anonymous buyer',
        productName: product?.name || null,
      },
    })
  } catch (error) {
    console.error('Customer query GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const parsed = patchQuerySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid payload' },
        { status: 400 }
      )
    }
    const body = parsed.data

    // Task 133: an empty PATCH is refused — a no-op that used to 200 AND
    // write an auditLogs row claiming an update happened (a fake event).
    if (body.replyMessage === undefined && body.status === undefined) {
      return NextResponse.json(
        { error: 'Nothing to update — send replyMessage and/or status.' },
        { status: 400 }
      )
    }

    const { id } = await params
    const existing = await db.sellerCustomerQueries.findFirst({
      where: { id, supplierId: profile.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 })
    }

    const updated = await db.sellerCustomerQueries.update({
      where: { id },
      data: {
        // A reply is real content — replying stamps repliedAt and flips the
        // status to 'replied' unless the seller explicitly chose another one.
        ...(body.replyMessage !== undefined && { replyMessage: body.replyMessage, repliedAt: new Date() }),
        ...(body.status && { status: body.status }),
        ...(body.replyMessage !== undefined && !body.status && { status: 'replied' }),
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_query_updated',
        entityType: 'sellerCustomerQueries',
        entityId: id,
        metadata: JSON.stringify({ supplierId: profile.id, status: updated.status, replied: body.replyMessage !== undefined }),
      },
    })

    return NextResponse.json({ success: true, data: updated, message: 'Query updated' })
  } catch (error) {
    console.error('Customer query PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
