import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { id } = await params
    const order = await db.orders.findUnique({
      where: { id },
      include: {
        shippingAddress: true,
        subOrders: {
          include: {
            trackingHistory: true,
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    thumbnailUrl: true,
                    unit: true,
                    basePrice: true,
                  }
                }
              }
            }
          }
        },
        buyer: {
          select: {
            id: true,
            email: true,
            phone: true,
            buyerProfile: {
              select: {
                fullName: true,
                businessName: true,
                businessType: true,
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: order
    })
  } catch (error) {
    console.error('Seller order GET error:', error)
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
    const { status, trackingNumber, carrier, notes } = body

    const updateData: any = {}
    if (status) updateData.status = status
    if (trackingNumber) updateData.trackingNumber = trackingNumber

    const updated = await db.subOrders.updateMany({
      where: {
        OR: [
          { id },
          { orderId: id }
        ]
      },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Order updated successfully'
    })
  } catch (error) {
    console.error('Seller order PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
