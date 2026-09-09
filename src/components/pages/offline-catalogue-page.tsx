'use client'

import React, { useState, useEffect } from 'react'
import { ShoppingBag, ArrowLeft, Search, Building2, Tag, Layers, CheckCircle2 } from 'lucide-react'
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

  useEffect(() => {
    fetch('/api/app/offline-sync')
      .then(res => res.json())
      .then(json => {
        if (json?.data?.catalogue?.products) {
          setProducts(json.data.catalogue.products)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))

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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className="rounded-2xl border shadow-sm overflow-hidden flex flex-col justify-between">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">MOQ: {p.minOrderQuantity} {p.unit || 'pcs'}</Badge>
                <span className="font-mono text-emerald-600 font-bold">In Local DB</span>
              </div>
              <h3 className="font-bold text-sm text-foreground line-clamp-2">{p.title}</h3>
              <div className="text-base font-black text-primary">
                ৳{p.priceBDT?.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">/ {p.unit || 'unit'}</span>
              </div>
            </CardContent>
            <div className="p-3 border-t bg-muted/20 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Stock: {p.stock}</span>
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
    </div>
  )
}
export default OfflineCataloguePage
