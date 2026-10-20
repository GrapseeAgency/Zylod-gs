import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { appVersionPatchSchema, shapeAppVersion } from '@/lib/app-status'

/**
 * Task 109: app releases — PATCH/DELETE. PATCH touches only arrived keys;
 * a platform+versionCode change is re-checked for clashes; DELETE removes
 * the release for good.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-appver-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.appVersions.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }
    const parsed = appVersionPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
    }
    const d = parsed.data
    const nextPlatform = d.platform ?? existing.platform
    const nextCode = d.versionCode ?? existing.versionCode
    if ((d.platform !== undefined && d.platform !== existing.platform) || (d.versionCode !== undefined && d.versionCode !== existing.versionCode)) {
      const clash = await db.appVersions.findFirst({ where: { platform: nextPlatform, versionCode: nextCode, id: { not: id } } })
      if (clash) {
        return NextResponse.json({ error: `${nextPlatform} already has versionCode ${nextCode} (${clash.versionNumber}) — one row per release` }, { status: 409 })
      }
    }
    const row = await db.appVersions.update({
      where: { id },
      data: {
        ...(d.platform !== undefined ? { platform: d.platform } : {}),
        ...(d.versionNumber !== undefined ? { versionNumber: d.versionNumber } : {}),
        ...(d.versionCode !== undefined ? { versionCode: d.versionCode } : {}),
        ...(d.minSupportedVersion !== undefined ? { minSupportedVersion: d.minSupportedVersion } : {}),
        ...(d.isMandatory !== undefined ? { isMandatory: d.isMandatory } : {}),
        ...(d.changelogEn !== undefined ? { changelogEn: d.changelogEn } : {}),
        ...(d.changelogBn !== undefined ? { changelogBn: d.changelogBn } : {}),
        ...(d.apkDownloadUrl !== undefined ? { apkDownloadUrl: d.apkDownloadUrl } : {}),
        ...(d.apkSizeBytes !== undefined ? { apkSizeBytes: d.apkSizeBytes } : {}),
        ...(d.releaseNotes !== undefined ? { releaseNotes: d.releaseNotes } : {}),
        ...(d.isPublished !== undefined ? { isPublished: d.isPublished } : {}),
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'app_version_updated',
        entityType: 'appVersions',
        entityId: row.id,
        metadata: JSON.stringify({
          before: { version: existing.versionNumber, code: existing.versionCode, isPublished: existing.isPublished },
          after: { version: row.versionNumber, code: row.versionCode, isPublished: row.isPublished },
        }),
      },
    })
    await tapAllAdmins('appstatus:changed', { action: 'release-updated', platform: row.platform, version: row.versionNumber })
    return NextResponse.json({ success: true, data: shapeAppVersion(row), message: 'Release updated' })
  } catch (error) {
    console.error('Admin app versions PATCH error:', error)
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
  const rl = checkRateLimit(request, 'admin-appver-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.appVersions.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }
    await db.appVersions.delete({ where: { id } })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'app_version_deleted',
        entityType: 'appVersions',
        entityId: existing.id,
        metadata: JSON.stringify({ platform: existing.platform, version: existing.versionNumber }),
      },
    })
    await tapAllAdmins('appstatus:changed', { action: 'release-deleted', platform: existing.platform, version: existing.versionNumber })
    return NextResponse.json({ success: true, message: 'Release deleted' })
  } catch (error) {
    console.error('Admin app versions DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
