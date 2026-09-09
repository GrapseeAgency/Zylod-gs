import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/app/storage-stats
 * Calculates server and local storage metrics for cache and local data management.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const userId = auth.authenticated && auth.user ? auth.user.id : undefined

    const [totalProducts, totalCategories, totalOrders, audits] = await Promise.all([
      db.products.count(),
      db.categories.count(),
      userId ? db.orders.count({ where: { buyerId: userId } }) : 0,
      userId ? db.storageCacheAudits.findMany({ where: { userId } }) : [],
    ])

    // Estimated category breakdowns in Bytes
    const estimates = {
      imageThumbnailsBytes: 45 * 1024 * 1024, // ~45 MB
      offlineCatalogueBytes: (totalProducts * 1200) + (totalCategories * 800), // ~2-4 MB
      userCacheBytes: (totalOrders * 3500) + 1024 * 500, // ~1.5 MB
      fontAssetsBytes: 4 * 1024 * 1024, // ~4 MB
    }

    const totalBytes = Object.values(estimates).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      data: {
        totalAllocatedMB: (totalBytes / (1024 * 1024)).toFixed(1),
        maxQuotaMB: 500,
        usagePercentage: ((totalBytes / (500 * 1024 * 1024)) * 100).toFixed(1),
        breakdown: [
          { category: 'Product Media & Swatches', sizeMB: (estimates.imageThumbnailsBytes / (1024 * 1024)).toFixed(1), color: '#3B82F6' },
          { category: 'Offline Wholesale Catalogue', sizeMB: (estimates.offlineCatalogueBytes / (1024 * 1024)).toFixed(1), color: '#10B981' },
          { category: 'Order Invoices & PDF Cache', sizeMB: (estimates.userCacheBytes / (1024 * 1024)).toFixed(1), color: '#F59E0B' },
          { category: 'System Web Fonts & Bundles', sizeMB: (estimates.fontAssetsBytes / (1024 * 1024)).toFixed(1), color: '#8B5CF6' },
        ],
        audits,
      },
    })
  } catch (error) {
    console.error('Storage stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/app/storage-stats
 * Logs a cache-clear audit event.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const body = await request.json()
    const { deviceId, cacheCategory = 'all' } = body

    const audit = await db.storageCacheAudits.create({
      data: {
        userId: auth.authenticated ? auth.user?.id : null,
        deviceId: deviceId || 'client-device',
        cacheCategory,
        storageBytes: BigInt(0),
        itemCount: 0,
        lastClearedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Cache category '${cacheCategory}' cleared successfully`,
      data: audit,
    })
  } catch (error) {
    console.error('Storage clear POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
