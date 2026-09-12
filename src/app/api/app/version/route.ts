import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BUNDLE_IDENTITY } from '@/generated/bundle-identity'

/**
 * GET /api/app/version
 * Checks for app updates. Compares client version with latest published release.
 * Query params: ?platform=android&currentVersionCode=231
 *
 * F1/F5 provenance (docs/PROVENANCE.md): this endpoint doubles as the native
 * shells' endpoint-discovery probe. Its FIRST obligation is to report WHICH
 * web bundle this server is serving (the `bundle` field) — unconditionally,
 * even when the database is unreachable: a DB outage must never make a
 * genuine Zylod server undiscoverable (that is what lets a foreign/stub
 * responder win discovery and then be refused by the provenance gate). The
 * update-check payload degrades gracefully instead of failing the response.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') || 'android'
  const currentVersionCode = parseInt(searchParams.get('currentVersionCode') || '200')

  // Update-check payload — best effort; the bundle identity below is NEVER
  // gated on the database answering.
  let data: Record<string, unknown> = {
    updateAvailable: false,
    currentVersion: '2.4.5',
    latestVersion: '2.4.5',
    isMandatory: false,
    degraded: true,
  }
  try {
    const latest = await db.appVersions.findFirst({
      where: { platform, isPublished: true },
      orderBy: { versionCode: 'desc' },
    })

    const history = await db.appVersions.findMany({
      where: { platform, isPublished: true },
      orderBy: { versionCode: 'desc' },
      take: 5,
    })

    if (!latest) {
      data = {
        updateAvailable: false,
        currentVersion: '2.4.0',
        latestVersion: '2.4.0',
        isMandatory: false,
      }
    } else {
      data = {
        updateAvailable: latest.versionCode > currentVersionCode,
        isMandatory: latest.isMandatory,
        latestVersion: {
          versionNumber: latest.versionNumber,
          versionCode: latest.versionCode,
          changelogEn: latest.changelogEn,
          changelogBn: latest.changelogBn,
          apkDownloadUrl: latest.apkDownloadUrl || '/downloads/zylod-b2b-v2.4.0.apk',
          apkSizeBytes: latest.apkSizeBytes ? Number(latest.apkSizeBytes) : 28500000,
          releasedAt: latest.releasedAt,
          releaseNotes: latest.releaseNotes,
        },
        history: history.map(h => ({
          versionNumber: h.versionNumber,
          versionCode: h.versionCode,
          changelogEn: h.changelogEn,
          releasedAt: h.releasedAt,
        })),
      }
    }
  } catch (error) {
    // DB down/unreachable: log, mark degraded, keep serving the identity.
    console.error('App version check GET error (bundle identity still served):', error)
  }

  return NextResponse.json({
    success: true,
    bundle: BUNDLE_IDENTITY,
    data,
  })
}
