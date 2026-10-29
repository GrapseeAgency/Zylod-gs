'use client'

/**
 * SizeGuideDialog (Task 129) — consumes GET /api/products/size-guide?productId=…,
 * real reference data for garment/textile categories (sizes table, measurement
 * steps, care tips). When the product's category has no specific guide, the
 * endpoint falls back to the general garment guide and says so — that `note`
 * is shown VERBATIM, never hidden.
 *
 * The fetch is lazy: only fires when the buyer opens the dialog.
 */
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Ruler, Loader2, Info, CheckCircle2 } from 'lucide-react'

interface SizeGuideData {
  guide?: {
    category: string
    unit: string
    sizes: Array<Record<string, string | number>>
    measurementGuide: Array<{ step: number; instruction: string }>
    tips: string[]
  }
  category?: string
  note?: string
  availableGuides?: Array<{ key: string; category: string }>
}

export function SizeGuideButton({ productId, className }: { productId: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<SizeGuideData | null>(null)

  const openDialog = async () => {
    setOpen(true)
    if (data || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/products/size-guide?productId=${encodeURIComponent(productId)}`)
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Could not load the size guide (HTTP ${res.status})`)
        return
      }
      setData(json.data as SizeGuideData)
    } catch {
      setError('Network error while loading the size guide. Check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }

  // First column label + key follow the guide's own row shape: garments key by
  // `size`, textiles/home-textiles key by `type` — never render "undefined".
  const firstKey = data?.guide?.sizes?.length
    ? (['size', 'type'].find((k) => k in data.guide!.sizes[0]) ?? Object.keys(data.guide.sizes[0])[0])
    : 'size'
  const firstLabel = firstKey === 'size' ? 'Size' : firstKey === 'type' ? 'Type' : firstKey
  const columns = data?.guide?.sizes?.length
    ? Object.keys(data.guide.sizes[0]).filter((k) => k !== firstKey)
    : []

  return (
    <>
      <Button
        variant="outline"
        onClick={openDialog}
        className={`h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 ${className ?? ''}`}
        data-testid="size-guide-button"
      >
        <Ruler className="h-3.5 w-3.5" /> Size guide
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] overflow-y-auto" data-testid="size-guide-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <Ruler className="h-4 w-4 text-primary" /> Size guide{data?.guide ? ` — ${data.guide.category}` : ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Real reference measurements. For bulk orders, confirm sizing with a sample before committing volume.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold text-slate-500 dark:text-neutral-400 dark:text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading size guide…
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {!loading && !error && data && !data.guide && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" /> No size guide exists for this product yet. Reference guides on the platform:
              </div>
              {(data.availableGuides ?? []).map((g) => (
                <div key={g.key} className="text-[11px] text-slate-600 dark:text-neutral-400 dark:text-neutral-500 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-slate-400 dark:text-neutral-500 shrink-0" /> {g.category}
                </div>
              ))}
              <p className="text-[11px] text-slate-400 dark:text-neutral-500 font-bold">
                Ask the supplier for measurements via “Request Quote” before ordering quantities that depend on sizing.
              </p>
            </div>
          )}

          {!loading && !error && data?.guide && (
            <div className="space-y-3">
              {data.note && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {data.note}
                </p>
              )}

              {data.guide.sizes.length > 0 && (
                <div className="border border-slate-100 dark:border-neutral-800 rounded-2xl overflow-hidden">
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-50 dark:bg-background sticky top-0">
                        <tr className="text-left text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          {[firstLabel, ...columns].map((c) => (
                            <th key={c} className="px-3 py-2 whitespace-nowrap capitalize">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.guide.sizes.map((row, i) => (
                          <tr key={i} className="border-t border-slate-50 dark:border-neutral-800">
                            <td className="px-3 py-1.5 font-black text-slate-700 dark:text-neutral-300">{String(row[firstKey] ?? '—')}</td>
                            {columns.map((c) => (
                              <td key={c} className="px-3 py-1.5 text-slate-600 dark:text-neutral-400 dark:text-neutral-500 font-bold whitespace-nowrap">{String(row[c])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="bg-slate-50 dark:bg-background border-t border-slate-100 dark:border-neutral-800 px-3 py-1.5 text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                    All measurements in {data.guide.unit}
                  </p>
                </div>
              )}

              {data.guide.measurementGuide.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">How to measure</p>
                  {data.guide.measurementGuide.map((m) => (
                    <p key={m.step} className="text-[11px] text-slate-600 dark:text-neutral-400 dark:text-neutral-500 font-bold flex gap-1.5">
                      <span className="text-slate-400 dark:text-neutral-500 shrink-0">{m.step}.</span> {m.instruction}
                    </p>
                  ))}
                </div>
              )}

              {data.guide.tips.length > 0 && (
                <div className="space-y-1 rounded-2xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 px-3 py-2">
                  {data.guide.tips.map((tip, i) => (
                    <p key={i} className="text-[11px] text-slate-600 dark:text-neutral-400 dark:text-neutral-500 font-bold flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> {tip}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default SizeGuideButton
