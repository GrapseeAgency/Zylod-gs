import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { appVersionSchema, shapeAppVersion } from '@/lib/app-status'

/**
 * Task 109: APP RELEASES (admin side). The update-check endpoint's
 * provenance duty (report the bundle identity even with a dead DB) was
 * already real; its UPDATE payload could only ever serve the degraded
 * hardcoded '2.4.5' because appVersions had zero writers. This is the
 * writer: real releases with semver + versionCode, per-platform
 * uniqueness enforced logically (a duplicate platform+versionCode is a
 * 409 — two rows claiming to be the same release would make the update
 * check a coin flip), drafts invisible (the reader already filters
 * isPublished).
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-appver-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const rows = await db.appVersions.findMany({ orderBy: [{ versionCode: 'desc' }] })
    return NextResponse.json({ success: true, data: rows.map(shapeAppVersion) })
  } catch (error) {
    console.error('Admin app versions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-appver-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = appVersionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
    }
    const d = parsed.data
    const dup = await db.appVersions.findFirst({ where: { platform: d.platform, versionCode: d.versionCode } })
    if (dup) {
      return NextResponse.json({ error: `${d.platform} already has versionCode ${d.versionCode} (${dup.versionNumber}) — one row per release` }, { status: 409 })
    }
    const row = await db.appVersions.create({
      data: {
        platform: d.platform,
        versionNumber: d.versionNumber,
        versionCode: d.versionCode,
        minSupportedVersion: d.minSupportedVersion ?? '1.0.0',
        isMandatory: d.isMandatory ?? false,
        changelogEn: d.changelogEn,
        changelogBn: d.changelogBn ?? null,
        apkDownloadUrl: d.apkDownloadUrl ?? null,
        apkSizeBytes: d.apkSizeBytes ?? null,
        releaseNotes: d.releaseNotes ?? null,
        isPublished: d.isPublished ?? true,
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'app_version_created',
        entityType: 'appVersions',
        entityId: row.id,
        metadata: JSON.stringify({ platform: row.platform, version: row.versionNumber, code: row.versionCode, isPublished: row.isPublished }),
      },
    })
    await tapAllAdmins('appstatus:changed', { action: 'release-created', platform: row.platform, version: row.versionNumber })
    return NextResponse.json({ success: true, data: shapeAppVersion(row), message: 'Release saved' }, { status: 201 })
  } catch (error) {
    console.error('Admin app versions POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
