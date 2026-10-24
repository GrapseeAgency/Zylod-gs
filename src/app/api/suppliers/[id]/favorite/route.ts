import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/suppliers/[id]/favorite — is the current buyer following this supplier?
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { id: supplierId } = await params
  if (!supplierId) {
    return NextResponse.json({ error: 'supplier id is required' }, { status: 400 })
  }

  const existing = await db.favoriteSuppliers.findUnique({
    where: { buyerId_supplierId: { buyerId: auth.user.id, supplierId } },
    select: { id: true, createdAt: true },
  })

  return NextResponse.json({
    success: true,
    data: { following: !!existing, followedAt: existing?.createdAt ?? null },
  })
}

// POST /api/suppliers/[id]/favorite — follow a supplier
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'favorite-supplier', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  const { id: supplierId } = await params
  if (!supplierId) {
    return NextResponse.json({ error: 'supplier id is required' }, { status: 400 })
  }

  const supplier = await db.supplierProfiles.findUnique({ where: { id: supplierId }, select: { id: true } })
  if (!supplier) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  }

  const record = await db.favoriteSuppliers.upsert({
    where: { buyerId_supplierId: { buyerId: auth.user.id, supplierId } },
    create: { buyerId: auth.user.id, supplierId },
    update: {},
  })

  return NextResponse.json({
    success: true,
    data: record,
    message: 'Following supplier',
  })
}

// DELETE /api/suppliers/[id]/favorite — unfollow a supplier
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'favorite-supplier', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  const { id: supplierId } = await params
  if (!supplierId) {
    return NextResponse.json({ error: 'supplier id is required' }, { status: 400 })
  }

  await db.favoriteSuppliers.deleteMany({
    where: { buyerId: auth.user.id, supplierId },
  })

  return NextResponse.json({
    success: true,
    message: 'Unfollowed supplier',
  })
}
