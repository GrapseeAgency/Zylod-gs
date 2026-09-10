import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const share = await (db as any).wishlistShares.findFirst({
      where: { buyerId: auth.user.id },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ success: true, data: share })
  } catch (error) {
    console.error('WishlistShare GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const { expiresIn, allowAddToCart, showPrices } = body
    const token = crypto.randomBytes(16).toString('hex')
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null
    const share = await (db as any).wishlistShares.upsert({
      where: { buyerId: auth.user.id },
      create: { buyerId: auth.user.id, token, expiresAt, allowAddToCart: allowAddToCart ?? true, showPrices: showPrices ?? true },
      update: { token, expiresAt, allowAddToCart: allowAddToCart ?? true, showPrices: showPrices ?? true, updatedAt: new Date() }
    })
    return NextResponse.json({ success: true, data: share, message: 'Share link created' })
  } catch (error) {
    console.error('WishlistShare POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    await (db as any).wishlistShares.deleteMany({ where: { buyerId: auth.user.id } })
    return NextResponse.json({ success: true, message: 'Share link revoked' })
  } catch (error) {
    console.error('WishlistShare DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
