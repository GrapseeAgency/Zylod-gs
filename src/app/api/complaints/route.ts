import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { serializeComplaint } from '@/lib/complaints'

/**
 * POST /api/complaints — the authenticated buyer files a complaint.
 *
 * Real behavior (no fake data):
 * - Creates a real `complaints` row with status 'open'. The cuid id IS the
 *   complaint identifier — no fabricated complaint numbers.
 * - Statuses are server-guarded and never client-set (see schema comment).
 * - When orderId is provided, the order must exist AND belong to the
 *   authenticated buyer (404 / 403 honestly). When subOrderId is provided it
 *   must belong to that same order.
 */

const CreateSchema = z.object({
  category: z.enum(['order_issue', 'product_quality', 'delivery', 'payment', 'seller_behavior', 'other']),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title must be 120 characters or fewer'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000, 'Description must be 5000 characters or fewer'),
  orderId: z.string().trim().min(1).max(255).optional(),
  subOrderId: z.string().trim().min(1).max(255).optional(),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'complaints-create', 10, 5 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { category, title, description, orderId, subOrderId } = parsed.data

    // A sub-order reference only makes sense together with its parent order.
    if (subOrderId && !orderId) {
      return NextResponse.json(
        { error: 'A sub-order reference requires the orderId of the order it belongs to' },
        { status: 400 }
      )
    }

    // Real ownership check: the referenced order (when given) must exist and
    // belong to the authenticated buyer — never another buyer's order.
    if (orderId) {
      const order = await db.orders.findUnique({
        where: { id: orderId },
        select: { id: true, buyerId: true, orderNumber: true },
      })
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      if (order.buyerId !== auth.user.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      if (subOrderId) {
        const subOrder = await db.subOrders.findUnique({
          where: { id: subOrderId },
          select: { id: true, orderId: true },
        })
        if (!subOrder || subOrder.orderId !== orderId) {
          return NextResponse.json(
            { error: 'Sub-order does not belong to this order' },
            { status: 400 }
          )
        }
      }
    }

    const created = await db.complaints.create({
      data: {
        buyerId: auth.user.id,
        orderId: orderId ?? null,
        subOrderId: subOrderId ?? null,
        category,
        title,
        description,
        status: 'open',
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: serializeComplaint(created),
        message: `Complaint filed. Your reference is ${created.id} — it is now open and waiting for review by the Zylod team.`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Complaint create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/complaints — the authenticated buyer's own complaints, newest first.
 * Optional ?status=<open|in_review|resolved|rejected|withdrawn|all>
 * (Zod-validated — anything else is a 400) and ?take (1..100, default 100).
 */
const ListQuerySchema = z.object({
  status: z
    .enum(['open', 'in_review', 'resolved', 'rejected', 'withdrawn', 'all'])
    .default('all'),
  take: z.coerce.number().int().min(1).max(100).default(100),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'complaints-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = request.nextUrl
    const parsed = ListQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      take: searchParams.get('take') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { status, take } = parsed.data

    // Buyer-scoped for real: only THIS buyer's rows can ever come back.
    const complaints = await db.complaints.findMany({
      where: {
        buyerId: auth.user.id,
        ...(status === 'all' ? {} : { status }),
      },
      orderBy: { createdAt: 'desc' },
      take,
    })

    return NextResponse.json({
      success: true,
      data: complaints.map(serializeComplaint),
    })
  } catch (error) {
    console.error('Complaints list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
