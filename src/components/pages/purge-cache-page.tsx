'use client'

import React, { useState } from 'react'
import { Trash2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function PurgeCachePage() {
  const { navigate } = useNavigationStore()
  const [purgedTag, setPurgedTag] = useState<string | null>(null)

  const handlePurge = (tag: string) => {
    setPurgedTag(tag)
    setTimeout(() => setPurgedTag(null), 2500)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('cache-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Cache Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Targeted Cache Invalidation</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Invalidate specific catalog, pricing, or currency cached tags instantly</p>
      </div>

      {purgedTag && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Cache tag &quot;{purgedTag}&quot; invalidated across local and edge layers.
        </div>
      )}

      <div className="space-y-3">
        {[
          { tag: 'products-bulk-pricing', title: 'Wholesale Tiered Pricing Tables', desc: 'Invalidates quantity discount rules and MOQ thresholds' },
          { tag: 'categories-tree', title: 'Category Taxonomy & Sub-category Tree', desc: 'Purges hierarchical category tree navigation' },
          { tag: 'currency-exchange-rates', title: 'BDT / USD / EUR Exchange Rates', desc: 'Forces instant sync with Bangladesh Bank FX rates' },
          { tag: 'supplier-storefronts', title: 'Supplier Profiles & Gold Badges', desc: 'Purges cached mill verification and rating snapshots' },
        ].map((item) => (
          <Card key={item.tag} className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-bold text-sm text-foreground">{item.title}</div>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePurge(item.tag)}
                className="text-xs font-bold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Invalidate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default PurgeCachePage
