import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { mediaAssetSchema, shapeMediaAsset } from '@/lib/press-investor'

/**
 * Task 110: MEDIA KIT (admin side). The press page has fetched
 * GET /api/press/media-kit since day one; mediaKitAssets had zero writers.
 * House contract: 401-first, rate limits, Zod STRICT, audits + taps.
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-mediakit-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const rows = await db.mediaKitAssets.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ success: true, data: rows.map(shapeMediaAsset) })
  } catch (error) {
    console.error('Admin media kit GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-mediakit-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = mediaAssetSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
    }
    const d = parsed.data
    const row = await db.mediaKitAssets.create({
      data: {
        assetType: d.assetType, title: d.title, description: d.description ?? null,
        fileUrl: d.fileUrl, thumbnailUrl: d.thumbnailUrl ?? null, fileSizeMB: d.fileSizeMB ?? null,
        fileFormat: d.fileFormat ?? null, isPublic: d.isPublic ?? true,
      },
    })
    await db.auditLogs.create({
      data: { actorId: auth.user.id, action: 'media_asset_created', entityType: 'mediaKitAssets', entityId: row.id, metadata: JSON.stringify({ assetType: row.assetType, title: row.title, isPublic: row.isPublic }) },
    })
    await tapAllAdmins('press:changed', { action: 'asset-created', title: row.title, assetType: row.assetType })
    return NextResponse.json({ success: true, data: shapeMediaAsset(row), message: 'Asset added' }, { status: 201 })
  } catch (error) {
    console.error('Admin media kit POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
