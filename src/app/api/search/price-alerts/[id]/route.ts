import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * PATCH /api/search/price-alerts/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const alert = await db.searchFilters.findFirst({
      where: { id, userId: auth.user.id }
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    let config: any = {}
    try { config = JSON.parse(alert.filterConfig) } catch {}
    if (body.isActive !== undefined) config.isActive = body.isActive
    if (body.targetPrice !== undefined) config.targetPrice = body.targetPrice

    const updated = await db.searchFilters.update({
      where: { id },
      data: {
        filterConfig: JSON.stringify(config)
      }
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Price alert PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}

/**
 * DELETE /api/search/price-alerts/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    await db.searchFilters.deleteMany({
      where: { id, userId: auth.user.id }
    })

    return NextResponse.json({ success: true, message: 'Alert deleted' })
  } catch (error) {
    console.error('Price alert DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 })
  }
}
