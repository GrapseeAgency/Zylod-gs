'use client'

import React from 'react'
import { Sparkles, ArrowLeft, Search, Building2, Tag, ShoppingBag } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function PageSuggestionsPage() {
  const { navigate } = useNavigationStore()

  const categories = [
    { title: 'RMG & Ready-Made Garments', page: 'category-navigation', count: '14,200+ SKUs' },
    { title: 'Jute & Sustainable Packaging', page: 'category-navigation', count: '3,800+ SKUs' },
    { title: 'Leather Footwear & Tannery Goods', page: 'category-navigation', count: '5,100+ SKUs' },
    { title: 'Agricultural Commodities & Grains', page: 'category-navigation', count: '6,400+ SKUs' },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('error-404')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to 404
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Suggested Wholesale Catalogs</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Top-ranked categories and high-volume supplier storefronts</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((c) => (
          <Card
            key={c.title}
            onClick={() => navigate(c.page as any)}
            className="cursor-pointer hover:border-primary transition-all p-5 rounded-2xl border shadow-sm group"
          >
            <div className="space-y-1">
              <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{c.title}</div>
              <div className="text-xs text-muted-foreground">{c.count}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default PageSuggestionsPage
