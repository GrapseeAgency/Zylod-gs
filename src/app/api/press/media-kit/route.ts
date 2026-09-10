import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/press/media-kit
 * Returns all public media kit assets grouped by type.
 */
export async function GET(request: NextRequest) {
  try {
    const assets = await db.mediaKitAssets.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'asc' },
    })

    const grouped: Record<string, typeof assets> = {}
    for (const asset of assets) {
      if (!grouped[asset.assetType]) grouped[asset.assetType] = []
      grouped[asset.assetType].push(asset)
    }

    return NextResponse.json({
      success: true,
      data: {
        assets,
        grouped,
        assetTypes: Object.keys(grouped),
        total: assets.length,
      },
    })
  } catch (error) {
    console.error('Media kit GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
