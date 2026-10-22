'use client'

/**
 * RelatedProductsRail (Task 129) — consumes GET /api/products/[id]/frequently-bought,
 * whose data is the seller's OTHER live approved products first, then the same
 * category from other suppliers. Every row carries the REAL source reason —
 * no invented "frequently bought" claims and no invented bundle pricing
 * (the endpoint's old modeled 10% offer was removed, never consumed here).
 *
 * Renders NOTHING when the endpoint returns an empty list — an honest no-op,
 * not an empty shell.
 */
import React, { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Loader2, Store } from 'lucide-react'

interface RelatedProduct {
  id: string
  name: string
  slug: string
  basePrice: number
  currency: string
  unit: string | null
  moq: number | null
  stock: number
  image: string | null
  supplier: { companyName: string; verificationStatus: string | null }
  reason: string
}

export function RelatedProductsRail({ productId }: { productId: string }) {
  const navigate = useNavigationStore((s) => s.navigate)
  const formatPrice = useCurrencyStore((s) => s.formatPrice)
  const [related, setRelated] = useState<RelatedProduct[] | null>(null)
  const [note, setNote] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setRelated(null)
    setNote(undefined)
    const load = async () => {
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(productId)}/frequently-bought?limit=6`)
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok && json?.success) {
          setRelated(Array.isArray(json.data?.related) ? json.data.related : [])
          setNote(json.data?.note)
        } else {
          setRelated([])
        }
      } catch {
        if (!cancelled) setRelated([])
      }
    }
    void load()
    return () => { cancelled = true }
  }, [productId])

  if (related === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 font-bold py-2" data-testid="related-products-loading">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading related products…
      </div>
    )
  }

  // Honest no-op: nothing real to show → render nothing.
  if (related.length === 0) return null

  return (
    <section className="space-y-3" data-testid="related-products-rail" aria-label="Related products">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black tracking-tight">Related products</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">live wholesale listings</span>
      </div>
      {note && <p className="text-[11px] text-slate-400 font-bold">{note}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:thin]">
        {related.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate('product-detail', { productId: p.id })}
            className="group shrink-0 w-[168px] text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            data-testid="related-product-card"
          >
            <div className="aspect-square bg-slate-50 dark:bg-slate-950 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image || '/placeholder.svg'}
                alt={p.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
            <div className="p-2.5 space-y-1">
              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 min-h-[2.2em]">{p.name}</p>
              <p className="flex items-center gap-1 text-[10px] text-slate-500 truncate">
                <Store className="h-3 w-3 shrink-0" /> {p.supplier.companyName}
              </p>
              <div className="flex items-center justify-between gap-1 pt-0.5">
                <span className="text-xs font-black text-primary">{formatPrice(p.basePrice)}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase">{p.unit || 'unit'}</span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  p.reason === 'From this supplier'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>{p.reason}</span>
                {(p.moq ?? 0) > 1 && <span className="text-[9px] text-slate-400 font-bold">MOQ {p.moq}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default RelatedProductsRail
