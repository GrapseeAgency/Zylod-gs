'use client'

/**
 * SELLER FLASH-SALE NOMINATION — Task 176-c. The previous page presented a
 * "Submit Items" button with NO onClick handler — pure showcase. There is no
 * flash-sale SELF-NOMINATION rail on Zylod: flash-sale campaigns are curated
 * by the Zylod admin team and pin specific supplier products into active
 * campaigns. The supplier's real view of "which of my SKUs are in a live
 * campaign" already lives on the promotion-participation rail
 * (GET /api/supplier/promotion-participation), surfaced by seller-promotions.
 *
 * This rewrite is an honest explanation + a real-time list of the supplier's
 * products currently pinned into an active campaign (read-only — the
 * supplier never self-nominates). If the read fails or returns nothing, the
 * empty state says exactly that. No fabricated form, no dead Submit button.
 */
import React, { useEffect, useState } from 'react'
import { ArrowLeft, Tag, Loader2, AlertCircle, Sparkles, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'

interface PinnedPromo {
  promotionId: string
  promotionTitle: string
  productId: string
  productName: string
  discountPercent?: number | null
  startsAt?: string | null
  endsAt?: string | null
}

export function SellerFlashSaleNominationPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const [pinned, setPinned] = useState<PinnedPromo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    fetch('/api/supplier/promotion-participation', { headers })
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!mounted) return
        if (res.status === 401) {
          setError('Sign in as a supplier to see your live campaign placements.')
          return
        }
        if (!res.ok || !json?.success) {
          setError(json?.error || `Failed to load campaign placements (${res.status}).`)
          return
        }
        // The rail returns { success, data: [{ id, name, type, value, validFrom,
        // validUntil, products: [{id, name}] }] } — grouped by campaign. Flatten
        // to one row per pinned product so each placement renders on its own card.
        const campaigns = Array.isArray(json.data) ? json.data : []
        const items: PinnedPromo[] = []
        for (const c of campaigns) {
          const products = Array.isArray(c.products) ? c.products : []
          for (const p of products) {
            items.push({
              promotionId: String(c.id ?? ''),
              promotionTitle: String(c.name ?? 'Untitled campaign'),
              productId: String(p.id ?? ''),
              productName: String(p.name ?? 'Untitled product'),
              // Promotions use type (percent|fixed) + value — only percent is a
              // discount badge worth surfacing here; fixed is a money amount we
              // cannot meaningfully render without currency formatting.
              discountPercent: c.type === 'percent' ? Number(c.value ?? 0) || null : null,
              startsAt: c.validFrom ?? null,
              endsAt: c.validUntil ?? null,
            })
          }
        }
        setPinned(items)
      })
      .catch(() => {
        if (mounted) setError('Could not reach the campaign service. Try again shortly.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} aria-label="Go back" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="font-bold text-base">Flash Sale Placement</h1>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 py-6 md:py-8 md:px-6 space-y-5 pb-24 md:pb-8">
        <div className="hidden md:block">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-2 text-xs font-semibold">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-black mt-2">Flash Sale Placement</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Flash sales are admin-curated — your products are pinned into active campaigns
          </p>
        </div>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Tag className="h-4 w-4" />
              </div>
              <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <p className="font-bold text-slate-900 dark:text-slate-100">Suppliers do not self-nominate</p>
                <p>
                  Flash-sale and campaign slots are curated by the Zylod admin team. When a buyer-visiting
                  campaign is built, admin pins specific supplier products into it; the discount is funded by the
                  platform and the supplier is always paid the full line value. There is no submission form here
                  because there is no self-nomination rail — submitting fake items would not put them in a sale.
                </p>
                <p>
                  To put a product forward for a future campaign, message Zylod support with the SKU and the
                  proposed discount. The decision is made on the admin side and the placement will appear below
                  the moment it goes live.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Your products currently in live campaigns
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-5 flex items-start gap-3 text-xs">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-bold">{error}</p>
                  {error.startsWith('Sign in') && (
                    <Button size="sm" onClick={() => navigate('login')} className="text-xs font-bold gap-1">
                      Sign in
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : pinned.length === 0 ? (
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-6 text-center space-y-2">
                <Sparkles className="h-7 w-7 mx-auto text-gray-400 dark:text-gray-500" />
                <h3 className="text-sm font-bold">No live campaign placements yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  None of your products are pinned into an active campaign right now. When admin places one of
                  your SKUs into a flash sale, the campaign and discount appear here in real time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pinned.map(p => (
                <Card key={`${p.promotionId}-${p.productId}`} className="rounded-2xl border shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{p.productName}</p>
                      <p className="text-xs text-muted-foreground truncate">in {p.promotionTitle}</p>
                      {p.endsAt && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          until {new Date(p.endsAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {typeof p.discountPercent === 'number' && (
                      <Badge className="bg-primary text-white text-[10px] font-bold shrink-0">
                        -{p.discountPercent}%
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={() => navigate('seller-promotions')} className="gap-1.5 text-xs font-semibold">
          <ExternalLink className="h-3.5 w-3.5" /> Open promotion dashboard
        </Button>
      </main>
    </div>
  )
}
export default SellerFlashSaleNominationPage
