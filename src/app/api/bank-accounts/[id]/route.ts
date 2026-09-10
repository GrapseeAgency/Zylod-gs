import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { id } = await params
    const userId = auth.user.id

    const existing = await db.paymentMethods.findFirst({
      where: { id, userId, type: 'bank' },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    }

    await db.paymentMethods.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Bank account removed successfully',
    })
  } catch (error) {
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
    const userId = auth.user.id
    const body = await request.json()

    if (body.isDefault) {
      await db.paymentMethods.updateMany({
        where: { userId, type: 'bank' },
        data: { isDefault: false },
      })
      await db.paymentMethods.update({
        where: { id },
        data: { isDefault: true },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account updated successfully',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
