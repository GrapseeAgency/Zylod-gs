import { z } from 'zod'

/**
 * Task 109: THE PLATFORM STATUS RAIL (shared contracts). Three tables whose
 * readers existed from day one (apk-download, service-status, diagnostics
 * probes) with zero writers: appVersions (the update-check fallback served
 * a degraded hardcoded '2.4.5' because no release row could exist),
 * maintenanceSchedules (the maintenance window API could never fire), and
 * appDiagnostics (the service-status page read a logged-ops journal nobody
 * could write). Standing rule: every request schema is .strict().
 */

export const APP_PLATFORMS = ['android', 'ios', 'web'] as const
export const AFFECTED_SERVICES = ['all', 'checkout', 'api', 'search'] as const
export const SERVICE_STATUSES = ['healthy', 'degraded', 'down'] as const

const semver = /^\d+\.\d+\.\d+$/
const semverMsg = 'Version must be semver (e.g. 2.4.0)'

export const appVersionSchema = z
  .object({
    platform: z.enum(APP_PLATFORMS),
    versionNumber: z.string().trim().regex(semver, semverMsg).max(20),
    versionCode: z.number().int().min(1, 'versionCode must be a positive integer').max(2_000_000_000),
    minSupportedVersion: z.string().trim().regex(semver, semverMsg).optional(),
    isMandatory: z.boolean().optional(),
    changelogEn: z.string().trim().min(1, 'English changelog is required').max(4000),
    changelogBn: z.string().trim().max(4000).optional().nullable(),
    apkDownloadUrl: z.string().trim().max(500).optional().nullable(),
    apkSizeBytes: z.number().int('APK size must be an integer byte count').min(0).optional().nullable(),
    releaseNotes: z.string().trim().max(4000).optional().nullable(),
    isPublished: z.boolean().optional(),
  })
  .strict()

export const appVersionPatchSchema = z
  .object({
    platform: z.enum(APP_PLATFORMS).optional(),
    versionNumber: z.string().trim().regex(semver, semverMsg).max(20).optional(),
    versionCode: z.number().int().min(1).max(2_000_000_000).optional(),
    minSupportedVersion: z.string().trim().regex(semver, semverMsg).optional(),
    isMandatory: z.boolean().optional(),
    changelogEn: z.string().trim().min(1, 'English changelog is required').max(4000).optional(),
    changelogBn: z.string().trim().max(4000).nullable().optional(),
    apkDownloadUrl: z.string().trim().max(500).nullable().optional(),
    apkSizeBytes: z.number().int().min(0).nullable().optional(),
    releaseNotes: z.string().trim().max(4000).nullable().optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()

export const maintenanceSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    messageEn: z.string().trim().min(1, 'English message is required').max(2000),
    messageBn: z.string().trim().max(2000).optional().nullable(),
    scheduledStart: z.string().datetime({ offset: true, message: 'scheduledStart must be an ISO datetime' }),
    scheduledEnd: z.string().datetime({ offset: true, message: 'scheduledEnd must be an ISO datetime' }),
    isActive: z.boolean().optional(),
    allowedIps: z.string().trim().max(500).optional().nullable(),
    affectedServices: z.enum(AFFECTED_SERVICES).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (new Date(d.scheduledEnd).getTime() <= new Date(d.scheduledStart).getTime()) {
      ctx.addIssue({ code: 'custom', message: 'scheduledEnd must be after scheduledStart' })
    }
  })

export const maintenancePatchSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120).optional(),
    messageEn: z.string().trim().min(1, 'English message is required').max(2000).optional(),
    messageBn: z.string().trim().max(2000).nullable().optional(),
    scheduledStart: z.string().datetime({ offset: true, message: 'scheduledStart must be an ISO datetime' }).optional(),
    scheduledEnd: z.string().datetime({ offset: true, message: 'scheduledEnd must be an ISO datetime' }).optional(),
    isActive: z.boolean().optional(),
    allowedIps: z.string().trim().max(500).nullable().optional(),
    affectedServices: z.enum(AFFECTED_SERVICES).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.scheduledStart && d.scheduledEnd && new Date(d.scheduledEnd).getTime() <= new Date(d.scheduledStart).getTime()) {
      ctx.addIssue({ code: 'custom', message: 'scheduledEnd must be after scheduledStart' })
    }
  })

export const diagnosticSchema = z
  .object({
    serviceName: z.string().trim().min(1, 'Service name is required').max(60),
    status: z.enum(SERVICE_STATUSES),
    responseTimeMs: z.number().int().min(0, 'Response time cannot be negative').max(600_000).optional(),
    details: z.string().trim().max(1000).optional().nullable(),
  })
  .strict()

export function shapeAppVersion(row: {
  id: string
  platform: string
  versionNumber: string
  versionCode: number
  minSupportedVersion: string
  isMandatory: boolean
  changelogEn: string
  changelogBn: string | null
  apkDownloadUrl: string | null
  apkSizeBytes: bigint | null
  releaseNotes: string | null
  isPublished: boolean
  releasedAt: Date
}) {
  return {
    id: row.id,
    platform: row.platform,
    versionNumber: row.versionNumber,
    versionCode: row.versionCode,
    minSupportedVersion: row.minSupportedVersion,
    isMandatory: row.isMandatory,
    changelogEn: row.changelogEn,
    changelogBn: row.changelogBn,
    apkDownloadUrl: row.apkDownloadUrl,
    apkSizeBytes: row.apkSizeBytes === null ? null : Number(row.apkSizeBytes),
    releaseNotes: row.releaseNotes,
    isPublished: row.isPublished,
    releasedAt: row.releasedAt.toISOString(),
  }
}

export function shapeMaintenance(row: {
  id: string
  title: string
  messageEn: string
  messageBn: string | null
  scheduledStart: Date
  scheduledEnd: Date
  isActive: boolean
  allowedIps: string | null
  affectedServices: string
}) {
  return {
    id: row.id,
    title: row.title,
    messageEn: row.messageEn,
    messageBn: row.messageBn,
    scheduledStart: row.scheduledStart.toISOString(),
    scheduledEnd: row.scheduledEnd.toISOString(),
    isActive: row.isActive,
    allowedIps: row.allowedIps,
    affectedServices: row.affectedServices,
  }
}

export function shapeDiagnostic(row: {
  id: string
  serviceName: string
  status: string
  responseTimeMs: number
  detailsJson: string | null
  checkedAt: Date
}) {
  return {
    id: row.id,
    serviceName: row.serviceName,
    status: row.status,
    responseTimeMs: row.responseTimeMs,
    details: row.detailsJson ? JSON.parse(row.detailsJson) : null,
    checkedAt: row.checkedAt.toISOString(),
  }
}
