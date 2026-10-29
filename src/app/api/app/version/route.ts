import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BUNDLE_IDENTITY } from '@/generated/bundle-identity'

/**
 * t230 STALE-DEVICE FLOOR: every release below this versionCode is running
 * a build with KNOWN defects the owner kept reporting (broken back stack,
 * offline white screen, guest ordering, navy chrome). The DB flag alone was
 * `false`, so devices on v2.3.0 (code 230) polled, saw a soft "update
 * available", and never updated — the owner then audited the OLD build and
 * reported all its bugs against the new one. Below the floor the update is
 * MANDATORY, no matter what the row says. 247 = v2.4.7 (navy-chrome fix).
 * 248 = v2.4.8 (native Kotlin Hot Deals screen + deals back-nav hardening).
 * Floor safety: android-build.yml builds the release APK FROM THIS COMMIT
 * (assembleRelease), so this commit's APK is versionCode 248 — a floor of
 * 248 can never gate-block the release it ships with (248 < 248 is false).
 */
const MIN_VERSION_CODE = 248

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
      const belowFloor = currentVersionCode < MIN_VERSION_CODE
      const updateAvailable = latest.versionCode > currentVersionCode || belowFloor
      data = {
        updateAvailable,
        // Mandatory only MEANINGFUL (and only reported) when an update is
        // actually available — an up-to-date device must never read "mandatory".
        isMandatory: updateAvailable && (belowFloor || latest.isMandatory),
        blockedVersionRange: belowFloor ? `< ${MIN_VERSION_CODE}` : undefined,
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
