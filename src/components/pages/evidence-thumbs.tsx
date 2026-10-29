'use client'

import React, { useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ImageIcon } from 'lucide-react'

/**
 * EvidenceThumbs — ADMIN-side, read-only evidence photo thumbnails for one
 * queue row (admin returns / admin complaints).
 *
 * Real behavior, no fake states:
 * - Photos come from the row's real evidence[] metadata (list endpoints).
 * - Small 40px thumbnails; clicking opens the FULL image in a Dialog via the
 *   same /api/attachments/[id] URL (owner-or-admin gated — the admin session
 *   is what authorizes the bytes).
 * - Empty rows show an honest "No evidence" — admins review, never upload or
 *   fabricate evidence, so there is deliberately no add/upload affordance.
 * - next/image is deliberately NOT used: photos are raw bytes behind an
 *   authed API route, so plain <img> with real alt text is the honest tool.
 */

export interface EvidenceThumb {
  id: string
  mimeType: string
  sizeBytes: number
  note: string | null
  url: string
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface EvidenceThumbsProps {
  photos: EvidenceThumb[]
  /** Section label — defaults to "Evidence". */
  label?: string
}

export function EvidenceThumbs({ photos, label = 'Evidence' }: EvidenceThumbsProps) {
  // One Dialog for THIS row, mounted only when there is something to view.
  const [openPhoto, setOpenPhoto] = useState<EvidenceThumb | null>(null)

  if (photos.length === 0) {
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 flex items-center gap-1.5">
          <ImageIcon className="h-3 w-3" /> {label} (0)
        </p>
        <p className="text-[10px] text-slate-400 dark:text-neutral-500">No evidence — the buyer attached no photos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 flex items-center gap-1.5">
        <ImageIcon className="h-3 w-3" /> {label} ({photos.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenPhoto(p)}
            title={p.note ? `Evidence photo: ${p.note}` : `Evidence photo ${i + 1}`}
            aria-label={`View evidence photo ${i + 1}${p.note ? `: ${p.note}` : ''}`}
            className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-neutral-800 dark:border-neutral-700 hover:border-slate-400 dark:hover:border-slate-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {/* Plain <img> — bytes come from the authed /api/attachments route. */}
            <img
              src={p.url}
              alt={p.note ? `Evidence photo: ${p.note}` : `Evidence photo ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      <Dialog open={openPhoto !== null} onOpenChange={(open) => { if (!open) setOpenPhoto(null) }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto">
          {openPhoto && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-slate-400 dark:text-neutral-500" /> Buyer evidence photo
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 break-words">
                  {openPhoto.note ? `“${openPhoto.note}”` : 'No caption was provided for this photo.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <img
                  src={openPhoto.url}
                  alt={openPhoto.note ? `Evidence photo: ${openPhoto.note}` : 'Buyer evidence photo'}
                  className="max-h-[65vh] w-full rounded-xl object-contain border border-slate-200 dark:border-neutral-800 dark:border-neutral-700 bg-slate-50 dark:bg-background"
                />
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums break-all">
                  {openPhoto.mimeType} · {formatBytes(openPhoto.sizeBytes)} · served by /api/attachments (owner/admin only)
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default EvidenceThumbs
