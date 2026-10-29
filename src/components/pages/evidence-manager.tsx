'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  AlertTriangle, ImageIcon, Loader2, Lock, Upload, X,
} from 'lucide-react'

/**
 * EvidenceManager — buyer-side evidence photo management for ONE owner row
 * (a return request or a complaint).
 *
 * Real behavior, no fake states:
 * - Loads the photo metadata from the owner detail endpoint (GET
 *   /api/returns/[id] or /api/complaints/[id]) — the same owner/admin-gated
 *   APIs that carry `evidencePhotos`. No optimistic writes anywhere: the grid
 *   is always re-read from the server after a 2xx upload/delete.
 * - Upload: hidden file input → honest client pre-checks (type allowlist +
 *   2 MB size) → POST multipart/form-data with the optional caption. The
 *   SERVER re-validates everything (including magic bytes) — its verbatim
 *   errors are shown, never masked with fake success.
 * - Delete: DELETE .../evidence/[photoId] — server errors verbatim.
 * - When canEdit is false the upload UI is replaced by the honest lock note
 *   (evidence locks at the review decision: returns 'pending' / complaints
 *   'open').
 * - next/image is deliberately NOT used: photos are raw bytes behind an
 *   authed API route, so plain <img> with real alt text is the honest tool.
 */

export interface EvidencePhoto {
  id: string
  mimeType: string
  sizeBytes: number
  note: string | null
  createdAt: string
  url: string
}

const EVIDENCE_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const EVIDENCE_MAX_BYTES = 2 * 1024 * 1024 // 2 MB — mirrors the server rule
const EVIDENCE_MAX_PHOTOS = 5 // mirrors the server rule
const EVIDENCE_NOTE_MAX_CHARS = 200 // mirrors the server rule

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface EvidenceManagerProps {
  ownerType: 'return' | 'complaint'
  ownerId: string
  /** True only while evidence can still change (return 'pending' / complaint 'open'). */
  canEdit: boolean
  /** Honest note shown instead of the upload UI once evidence is locked. */
  lockedNote?: string
  /** Reported after every successful load so parents can show real counts. */
  onCount?: (count: number) => void
}

export function EvidenceManager({ ownerType, ownerId, canEdit, lockedNote, onCount }: EvidenceManagerProps) {
  const base = ownerType === 'return' ? `/api/returns/${ownerId}` : `/api/complaints/${ownerId}`

  const [photos, setPhotos] = useState<EvidencePhoto[] | null>(null)
  const [listError, setListError] = useState('')
  const [listLoading, setListLoading] = useState(true)

  // Pending upload (staged file + optional caption) — nothing optimistic.
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingError, setPendingError] = useState('')
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const onCountRef = useRef(onCount)
  useEffect(() => {
    onCountRef.current = onCount
  })

  const loadEvidence = useCallback(async () => {
    setListLoading(true)
    setListError('')
    try {
      const res = await fetch(base, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        setPhotos(null)
        setListError('Your session cannot view this evidence — sign in with the account that filed it.')
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.data) {
        // Verbatim server error (404 unknown id, 429, 5xx …) — never masked.
        setListError(json?.error || `Failed to load evidence photos (HTTP ${res.status})`)
        setPhotos(null)
        return
      }
      const list: EvidencePhoto[] = Array.isArray(json.data.evidencePhotos) ? json.data.evidencePhotos : []
      setPhotos(list)
      onCountRef.current?.(list.length)
    } catch {
      setListError('Network error while loading evidence photos. Check your connection and retry.')
      setPhotos(null)
    } finally {
      setListLoading(false)
    }
  }, [base])

  useEffect(() => {
    loadEvidence()
  }, [loadEvidence])

  // Honest client-side pre-checks (the server re-checks everything, including
  // magic bytes — these only catch obvious mistakes before the upload).
  const pickFile = (file: File | null) => {
    setPendingError('')
    if (!file) return
    if (file.size === 0) {
      setPendingError('The selected file is empty.')
      return
    }
    if (!EVIDENCE_ALLOWED_TYPES.includes(file.type)) {
      setPendingError(
        `"${file.type || file.name}" is not a supported image — choose a PNG, JPEG, or WebP file.`
      )
      return
    }
    if (file.size > EVIDENCE_MAX_BYTES) {
      setPendingError(`The photo is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is 2 MB.`)
      return
    }
    setPendingFile(file)
  }

  const clearPending = () => {
    setPendingFile(null)
    setNote('')
    setPendingError('')
  }

  const upload = async () => {
    if (!pendingFile) return
    setUploading(true)
    setPendingError('')
    try {
      const fd = new FormData()
      fd.append('file', pendingFile)
      const trimmed = note.trim()
      if (trimmed.length > 0) fd.append('note', trimmed)

      const res = await fetch(`${base}/evidence`, { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Real backend error verbatim (409 status/count lock, 413 size, 400 signature, …).
        const msg = json?.error || `Upload failed (HTTP ${res.status})`
        setPendingError(msg)
        toast.error(msg)
        return
      }
      toast.success(json.message || 'Evidence photo attached.')
      clearPending()
      await loadEvidence()
    } catch {
      const msg = 'Network error while uploading the photo. Check your connection and retry.'
      setPendingError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async (photoId: string) => {
    setDeletingId(photoId)
    try {
      const res = await fetch(`${base}/evidence/${photoId}`, { method: 'DELETE', credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = json?.error || `Delete failed (HTTP ${res.status})`
        toast.error(msg)
        return
      }
      toast.success(json.message || 'Evidence photo removed.')
      await loadEvidence()
    } catch {
      toast.error('Network error while removing the photo. Check your connection and retry.')
    } finally {
      setDeletingId(null)
    }
  }

  const photoCount = photos?.length ?? 0

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 flex items-center gap-1.5">
        <ImageIcon className="h-3 w-3" />
        Evidence photos {photos ? `(${photoCount})` : ''}
      </p>

      {/* Evidence list — real states only */}
      {listLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : listError ? (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-600 dark:text-red-400 font-bold break-words">{listError}</p>
          <button
            onClick={loadEvidence}
            className="ml-auto shrink-0 text-[11px] text-red-600 dark:text-red-400 underline underline-offset-2 font-bold"
          >
            Retry
          </button>
        </div>
      ) : photos && photos.length === 0 ? (
        <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500">No evidence photos attached yet.</p>
      ) : (
        photos && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={p.id} className="min-w-0">
                <div className="relative">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    title="View full size"
                    className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                  >
                    {/* Plain <img> — the bytes come from the authed /api/attachments route. */}
                    <img
                      src={p.url}
                      alt={p.note ? `Evidence photo: ${p.note}` : `Evidence photo ${i + 1}`}
                      loading="lazy"
                      className="h-24 w-full rounded-xl object-cover border border-slate-200 dark:border-neutral-800 dark:border-neutral-700"
                    />
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      disabled={deletingId !== null}
                      aria-label={`Delete evidence photo ${i + 1}${p.note ? `: ${p.note}` : ''}`}
                      className="absolute top-0 right-0 w-11 h-11 rounded-xl bg-neutral-900/70 text-white flex items-center justify-center hover:bg-red-600 disabled:opacity-60 transition-colors"
                    >
                      {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                {p.note && (
                  <p className="text-[10px] text-slate-600 dark:text-neutral-400 dark:text-neutral-500 dark:text-neutral-300 mt-1 truncate" title={p.note}>
                    {p.note}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums">{formatBytes(p.sizeBytes)}</p>
              </div>
            ))}
          </div>
        )
      )}

      {/* Upload — only while evidence is genuinely editable */}
      {canEdit && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-neutral-800 dark:border-neutral-700 p-3 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Choose an evidence photo"
            onChange={(e) => {
              pickFile(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          {!pendingFile ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || photoCount >= EVIDENCE_MAX_PHOTOS}
              className="min-h-11 w-full rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-neutral-800 dark:border-neutral-700"
            >
              <Upload className="h-3.5 w-3.5" />
              {photoCount >= EVIDENCE_MAX_PHOTOS ? `Photo limit reached (${photoCount})` : 'Add photo'}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-300 truncate" title={pendingFile.name}>
                  {pendingFile.name}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums shrink-0">{formatBytes(pendingFile.size)}</span>
              </div>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={EVIDENCE_NOTE_MAX_CHARS}
                placeholder="Caption (optional)"
                aria-label="Evidence photo caption (optional)"
                className="h-10 rounded-xl text-xs"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={upload}
                  disabled={uploading}
                  className="min-h-11 flex-1 rounded-xl text-xs font-bold gap-1.5"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? 'Uploading…' : 'Upload photo'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearPending}
                  disabled={uploading}
                  className="min-h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-neutral-800 dark:border-neutral-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {pendingError && (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-bold break-words">{pendingError}</p>
          )}
          <p className="text-[10px] text-slate-400 dark:text-neutral-500 leading-relaxed">
            PNG, JPEG, or WebP up to 2 MB — up to {EVIDENCE_MAX_PHOTOS} photos. Each file is checked against its real
            signature. Photos are visible only to you and the Zylod review team, and lock once the review decision is
            made.
          </p>
        </div>
      )}

      {/* Honest lock note — evidence cannot be changed after review starts */}
      {!canEdit && (
        <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 px-3 py-2">
          <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 leading-relaxed">
            {lockedNote || 'Evidence is locked — photos can no longer be added or removed.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default EvidenceManager
