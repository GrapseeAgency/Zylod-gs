import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/categories/[id]/favorite — is the current buyer following this category?
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { id: categoryId } = await params
  if (!categoryId) {
    return NextResponse.json({ error: 'category id is required' }, { status: 400 })
  }

  const existing = await db.followedCategories.findUnique({
    where: { buyerId_categoryId: { buyerId: auth.user.id, categoryId } },
    select: { id: true, createdAt: true, notifyOnNew: true },
  })

  return NextResponse.json({
    success: true,
    data: {
      following: !!existing,
      notifyOnNew: existing?.notifyOnNew ?? false,
      followedAt: existing?.createdAt ?? null,
    },
  })
}

// POST /api/categories/[id]/favorite — follow a category
// Body: { notifyOnNew?: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'favorite-category', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  const { id: categoryId } = await params
  if (!categoryId) {
    return NextResponse.json({ error: 'category id is required' }, { status: 400 })
  }

  let body: any = {}
  try { body = await request.json() } catch {}
  const notifyOnNew = !!body.notifyOnNew

  const category = await db.categories.findUnique({ where: { id: categoryId }, select: { id: true } })
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  const record = await db.followedCategories.upsert({
    where: { buyerId_categoryId: { buyerId: auth.user.id, categoryId } },
    create: { buyerId: auth.user.id, categoryId, notifyOnNew },
    update: { notifyOnNew },
  })

  return NextResponse.json({
    success: true,
    data: record,
    message: 'Following category',
  })
}

// DELETE /api/categories/[id]/favorite — unfollow a category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'favorite-category', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  const { id: categoryId } = await params
  if (!categoryId) {
    return NextResponse.json({ error: 'category id is required' }, { status: 400 })
  }

  await db.followedCategories.deleteMany({
    where: { buyerId: auth.user.id, categoryId },
  })

  return NextResponse.json({
    success: true,
    message: 'Unfollowed category',
  })
}
