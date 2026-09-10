import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/app/diagnostics
 * Executes live health probes across database, memory, and services.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Probe database
    const dbStart = Date.now()
    const productCount = await db.products.count()
    const dbLatencyMs = Date.now() - dbStart

    // 2. Fetch logged services status
    const diagnosticsList = await db.appDiagnostics.findMany({
      orderBy: { checkedAt: 'desc' },
      take: 10,
    })

    const totalLatencyMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
      latencyMs: totalLatencyMs,
      metrics: {
        serverUptimeHours: Math.floor(process.uptime() / 3600),
        databaseLatencyMs: dbLatencyMs,
        activeProductRecords: productCount,
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        nodeEnvironment: process.env.NODE_ENV || 'production',
      },
      services: diagnosticsList.map(d => ({
        serviceName: d.serviceName,
        status: d.status,
        responseTimeMs: d.responseTimeMs,
        details: d.detailsJson ? JSON.parse(d.detailsJson) : null,
      })),
    })
  } catch (error) {
    console.error('Diagnostics check error:', error)
    return NextResponse.json({
      success: false,
      status: 'degraded',
      error: String(error),
      latencyMs: Date.now() - startTime,
    }, { status: 500 })
  }
}
