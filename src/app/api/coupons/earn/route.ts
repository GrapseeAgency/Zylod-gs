import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * GET /api/coupons/earn
 * List available gamified coupon earning tasks.
 *
 * POST /api/coupons/earn
 * Complete task and award voucher to user.
 * Body: { taskId: string }
 */
export async function GET() {
  try {
    const tasks = await db.couponEarningTasks.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ success: true, data: tasks })
  } catch (error) {
    console.error('Coupon earn tasks GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const task = await db.couponEarningTasks.findUnique({
      where: { id: taskId },
    })

    if (!task || !task.isActive) {
      return NextResponse.json({ error: 'Task not found or inactive' }, { status: 404 })
    }

    // Generate unique earned voucher code
    const generatedCode = `EARN-${task.type.toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    const validUntil = new Date(Date.now() + 14 * 86400000) // 14 days valid

    const earnedCoupon = await db.userCoupons.create({
      data: {
        userId: auth.user.id,
        couponId: task.id,
        code: generatedCode,
        title: `Reward: ${task.title}`,
        discountStyle: 'fixed',
        discountLabel: task.rewardLabel,
        status: 'active',
        validUntil,
        savingsBDT: task.rewardBDT,
        minOrderBDT: task.rewardBDT * 5,
        categoryLabel: 'Task Reward',
        categoryColor: task.iconColor || '#C8102E',
      },
    })

    // Dispatch real notification
    await sendNotification({
      userId: auth.user.id,
      type: 'promotion',
      title: `Task Reward Unlocked: ${task.rewardLabel}`,
      body: `You completed "${task.title}" and earned a ৳${task.rewardBDT} discount voucher! Use code ${generatedCode} at checkout.`,
      relatedEntityId: earnedCoupon.id,
    })

    return NextResponse.json({
      success: true,
      message: 'Task completed and coupon earned!',
      data: earnedCoupon,
    }, { status: 201 })
  } catch (error) {
    console.error('Coupon earn complete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}