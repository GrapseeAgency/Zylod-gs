import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const query = await db.sellerCustomerQueries.findUnique({
      where: { id }
    })
    if (!query) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: query })
  } catch (error) {
    console.error('Customer query GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json()
    const { replyMessage, status = 'replied' } = body

    const updated = await db.sellerCustomerQueries.update({
      where: { id },
      data: {
        replyMessage,
        status,
        repliedAt: new Date()
      }
    })
    return NextResponse.json({ success: true, data: updated, message: 'Reply sent successfully' })
  } catch (error) {
    console.error('Customer query PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}