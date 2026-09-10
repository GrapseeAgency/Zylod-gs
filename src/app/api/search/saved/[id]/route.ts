import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * DELETE /api/search/saved/[id]
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
      where: {
        id,
        userId: auth.user.id
      }
    })

    return NextResponse.json({ success: true, message: 'Saved search deleted' })
  } catch (error) {
    console.error('Saved search DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 })
  }
}
