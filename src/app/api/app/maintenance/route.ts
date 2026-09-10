import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/app/maintenance
 * Checks whether platform maintenance mode is currently active or upcoming.
 */
export async function GET(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

    // Check if active maintenance exists
    const active = await db.maintenanceSchedules.findFirst({
      where: {
        isActive: true,
      },
      orderBy: { scheduledStart: 'desc' },
    })

    // Check if upcoming maintenance exists
    const upcoming = await db.maintenanceSchedules.findFirst({
      where: {
        isActive: false,
        scheduledStart: { gt: new Date() },
      },
      orderBy: { scheduledStart: 'asc' },
    })

    // If client IP is whitelisted, bypass maintenance
    const isWhitelisted = active?.allowedIps?.split(',').map(s => s.trim()).includes(clientIp) || false

    return NextResponse.json({
      success: true,
      data: {
        isMaintenanceActive: !!active && !isWhitelisted,
        activeSchedule: active ? {
          title: active.title,
          messageEn: active.messageEn,
          messageBn: active.messageBn,
          scheduledStart: active.scheduledStart,
          scheduledEnd: active.scheduledEnd,
          affectedServices: active.affectedServices,
        } : null,
        upcomingSchedule: upcoming ? {
          title: upcoming.title,
          messageEn: upcoming.messageEn,
          scheduledStart: upcoming.scheduledStart,
          scheduledEnd: upcoming.scheduledEnd,
        } : null,
      },
    })
  } catch (error) {
    console.error('Maintenance check GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
