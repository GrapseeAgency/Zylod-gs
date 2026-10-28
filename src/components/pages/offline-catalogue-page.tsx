'use client'

import React, { useState, useEffect } from 'react'
import { ShoppingBag, ArrowLeft, Search, Building2, Tag, Layers, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function OfflineCataloguePage() {
  const { navigate } = useNavigationStore()
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/app/offline-sync')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error || `Failed to load the offline package (${res.status})`)
        if (json?.data?.catalogue?.products) {
          // Map the API's REAL field names (name/moq/basePrice/stockQuantity) —
          // the previous code invented title/minOrderQuantity/priceBDT/stock,
          // so p.title.toLowerCase() crashed the whole page (t187 sweep).
          setProducts(json.data.catalogue.products.map((p: any) => ({
            id: p.id,
            name: p.name || 'Unnamed product',
            slug: p.slug || '',
            unit: p.unit || 'pcs',
            moq: p.moq ?? 1,
            basePrice: p.basePrice ?? 0,
            stockQuantity: p.stockQuantity ?? 0,
            thumbnailUrl: p.thumbnailUrl || null,
          })))
        }
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load the offline catalogue')
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('offline-mode')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Offline Engine
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Offline Wholesale Catalogue</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Locally cached product specifications, tiered prices, and MOQs</p>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search offline products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs"
          />
        </div>
      </div>

      {loadError ? (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-800 dark:text-red-300 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          Could not load the offline package: {loadError} Reload to try again.
        </div>
      ) : loading ? (
        <div className="text-xs text-muted-foreground">Loading offline package…</div>
      ) : products.length === 0 ? (
        <div className="text-xs text-muted-foreground">The offline package contains no products yet.</div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className="rounded-2xl border shadow-sm overflow-hidden flex flex-col justify-between">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">MOQ: {p.moq} {p.unit}</Badge>
                <span className="font-mono text-emerald-600 font-bold">In Local DB</span>
              </div>
              <h3 className="font-bold text-sm text-foreground line-clamp-2">{p.name}</h3>
              <div className="text-base font-black text-primary">
                ৳{p.basePrice?.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">/ {p.unit}</span>
              </div>
            </CardContent>
            <div className="p-3 border-t bg-muted/20 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Stock: {p.stockQuantity}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('product-detail', { id: p.id })}
                className="text-xs font-semibold h-7"
              >
                Inspect Cached Specs
              </Button>
            </div>
          </Card>
        ))}
      </div>
      )}
    </div>
  )
}
export default OfflineCataloguePage
