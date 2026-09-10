import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/app/offline-sync
 * Downloads essential offline data package (categories, top products, suppliers, basic settings)
 * for offline browsing in remote warehouses/factories.
 */
export async function GET(request: NextRequest) {
  try {
    const [categories, featuredProducts, verifiedSuppliers, settings] = await Promise.all([
      db.categories.findMany({
        where: { isActive: true },
        take: 30,
        select: { id: true, name: true, slug: true, iconUrl: true },
      }),
      db.products.findMany({
        where: { isActive: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          moq: true,
          supplierId: true,
          thumbnailUrl: true,
          stockQuantity: true,
          unit: true,
        },
      }),
      db.supplierProfiles.findMany({
        take: 20,
        select: {
          id: true,
          companyName: true,
          ratingAvg: true,
          verificationStatus: true,
        },
      }),
      db.appSystemSettings.findMany({
        where: { isPublic: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        version: '2026.08.18',
        catalogue: {
          categories,
          products: featuredProducts,
          suppliers: verifiedSuppliers,
          settings: settings.reduce((acc: Record<string, string>, s) => {
            acc[s.key] = s.value
            return acc
          }, {}),
        },
      },
    })
  } catch (error) {
    console.error('Offline sync package GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/app/offline-sync
 * Pushes queued actions executed while the user was offline (e.g. wishlist saves, drafts, cart updates).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const body = await request.json()
    const { deviceId, queue = [] } = body

    if (!Array.isArray(queue) || queue.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0, message: 'Queue is empty' })
    }

    const processed: string[] = []

    for (const item of queue) {
      const { syncAction, entityType, payload } = item
      const record = await db.offlineSyncQueue.create({
        data: {
          userId: auth.authenticated ? auth.user?.id : null,
          deviceId: deviceId || 'device-unknown',
          syncAction: syncAction || 'SYNC_ACTION',
          entityType: entityType || 'generic',
          payloadJson: JSON.stringify(payload || {}),
          status: 'completed',
          syncedAt: new Date(),
        },
      })
      processed.push(record.id)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${processed.length} offline operations`,
      processedCount: processed.length,
      processedIds: processed,
    })
  } catch (error) {
    console.error('Offline sync push error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
