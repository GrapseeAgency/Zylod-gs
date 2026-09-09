import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/app/telemetry
 * Records 404/500 errors, crash logs, and unexpected application states.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      errorCode = 'CLIENT_ERROR',
      statusCode = 500,
      message,
      stackTrace,
      route,
      method = 'GET',
      platform = 'web',
      appVersion = '2.4.0',
      metadata = {},
    } = body

    const userAgent = request.headers.get('user-agent') || undefined
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

    const errorLog = await db.errorTelemetryLogs.create({
      data: {
        errorCode: String(errorCode).slice(0, 50),
        statusCode: Number(statusCode) || 500,
        message: String(message || 'Unspecified Error').slice(0, 2000),
        stackTrace: stackTrace ? String(stackTrace).slice(0, 5000) : null,
        route: route ? String(route).slice(0, 255) : null,
        method: String(method).slice(0, 10),
        userAgent,
        clientIp,
        platform,
        appVersion,
        metadataJson: JSON.stringify(metadata),
      },
    })

    return NextResponse.json({
      success: true,
      ticketRef: `ERR-${errorLog.id.slice(-6).toUpperCase()}`,
      logId: errorLog.id,
    })
  } catch (error) {
    console.error('Error telemetry POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
