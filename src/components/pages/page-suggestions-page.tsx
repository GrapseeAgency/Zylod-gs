'use client'

/**
 * PAGE SUGGESTIONS — Task 176-c. The previous page shipped HARDCODED category
 * rows with fabricated SKU counts ("14,200+ SKUs", "3,800+ SKUs", "5,100+
 * SKUs", "6,400+ SKUs") painted as if they were live marketplace totals — none
 * of those numbers came from any table. This rewrite wires the page to the
 * REAL /api/categories rail (root categories with their actual productCount
 * and supplierCount as computed by the server), with an honest empty state
 * when the catalog is empty. No fabricated counts ever again.
 */
import React, { useEffect, useState } from 'react'
import { ArrowLeft, Sparkles, Loader2, Package, Building2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

interface CategorySuggestion {
  id: string
  name: string
  slug: string
  productCount: number
  supplierCount: number
}

export function PageSuggestionsPage() {
  const { navigate } = useNavigationStore()
  const [cats, setCats] = useState<CategorySuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/categories')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!mounted) return
        if (!res.ok || !json?.success) {
          setError(json?.error || `Failed to load categories (${res.status})`)
          return
        }
        const items: CategorySuggestion[] = Array.isArray(json.data)
          ? json.data.map((c: any) => ({
              id: String(c.id ?? ''),
              name: String(c.name ?? 'Untitled'),
              slug: String(c.slug ?? ''),
              productCount: Number(c.productCount ?? 0),
              supplierCount: Number(c.supplierCount ?? 0),
            }))
          : []
        // Surface categories that actually have product listings first.
        items.sort((a, b) => b.productCount - a.productCount)
        setCats(items)
      })
      .catch(() => {
        if (mounted) setError('Could not reach the catalog service. Try again shortly.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('error-404')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to 404
      </Button>

      <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
        <h1 className="text-2xl font-black text-foreground">Suggested Wholesale Catalogs</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Live category directory — product and supplier counts come straight from the catalog
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-6 flex items-start gap-3 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-bold text-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => navigate('home')} className="text-xs font-semibold">
                Back to home
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : cats.length === 0 ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <Sparkles className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500" />
            <h2 className="text-sm font-bold text-foreground">No categories published yet</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              When Zylod suppliers list products under catalog categories, those categories will appear here with
              their real product and supplier counts. We never publish invented catalog totals.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('home')} className="text-xs font-semibold">
              Back to home
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cats.map(c => (
            <Card
              key={c.id}
              onClick={() => navigate('category-browser', { slug: c.slug })}
              className="cursor-pointer hover:border-primary transition-all p-5 rounded-2xl border shadow-sm group"
            >
              <div className="space-y-1.5">
                <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {c.name}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" />
                  <span>{c.productCount.toLocaleString()} product{c.productCount === 1 ? '' : 's'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span>{c.supplierCount.toLocaleString()} supplier{c.supplierCount === 1 ? '' : 's'}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
export default PageSuggestionsPage
