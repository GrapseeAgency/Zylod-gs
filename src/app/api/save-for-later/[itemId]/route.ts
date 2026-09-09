import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { itemId } = await params
    await (db as any).savedForLater.deleteMany({
      where: { id: itemId, buyerId: auth.user.id }
    })
    return NextResponse.json({ success: true, message: 'Item removed' })
  } catch (error) {
    console.error('SaveForLater DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
