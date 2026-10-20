import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { mediaAssetPatchSchema, shapeMediaAsset } from '@/lib/press-investor'

/** Task 110: media kit — PATCH (arrived keys only) and DELETE per asset. */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-mediakit-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.mediaKitAssets.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    const parsed = mediaAssetPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
    }
    const d = parsed.data
    const row = await db.mediaKitAssets.update({
      where: { id },
      data: {
        ...(d.assetType !== undefined ? { assetType: d.assetType } : {}),
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.fileUrl !== undefined ? { fileUrl: d.fileUrl } : {}),
        ...(d.thumbnailUrl !== undefined ? { thumbnailUrl: d.thumbnailUrl } : {}),
        ...(d.fileSizeMB !== undefined ? { fileSizeMB: d.fileSizeMB } : {}),
        ...(d.fileFormat !== undefined ? { fileFormat: d.fileFormat } : {}),
        ...(d.isPublic !== undefined ? { isPublic: d.isPublic } : {}),
      },
    })
    await db.auditLogs.create({
      data: { actorId: auth.user.id, action: 'media_asset_updated', entityType: 'mediaKitAssets', entityId: row.id, metadata: JSON.stringify({ before: { title: existing.title, isPublic: existing.isPublic }, after: { title: row.title, isPublic: row.isPublic } }) },
    })
    await tapAllAdmins('press:changed', { action: 'asset-updated', title: row.title })
    return NextResponse.json({ success: true, data: shapeMediaAsset(row), message: 'Asset updated' })
  } catch (error) {
    console.error('Admin media kit PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-mediakit-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.mediaKitAssets.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    await db.mediaKitAssets.delete({ where: { id } })
    await db.auditLogs.create({
      data: { actorId: auth.user.id, action: 'media_asset_deleted', entityType: 'mediaKitAssets', entityId: existing.id, metadata: JSON.stringify({ title: existing.title }) },
    })
    await tapAllAdmins('press:changed', { action: 'asset-deleted', title: existing.title })
    return NextResponse.json({ success: true, message: 'Asset deleted' })
  } catch (error) {
    console.error('Admin media kit DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
