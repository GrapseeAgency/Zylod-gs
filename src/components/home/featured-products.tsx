'use client'

import React, { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { MainProductCard, type MainProduct } from './main-product-card'
import { ProductCardSkeleton } from '@/components/shared/loading-skeletons'

/* ─── t210-r2: "Featured Products" section per mockup —
   red vertical bar + bold heading + View All link, 6-col grid of cards. */

interface ApiProduct {
  id: string
  name: string
  basePrice: number
  moq: number
  soldCount: number
  isCustomizable: boolean
  unit?: string | null
  ratingAvg?: number | null
  reviewCount?: number | null
  thumbnailUrl?: string | null
  category?: { slug: string; name: string }
  supplier?: { companyName: string; verificationStatus?: string }
}

function mapApiProduct(p: ApiProduct): MainProduct {
  return {
    id: p.id,
    name: p.name,
    price: p.basePrice,
    originalPrice: p.basePrice,
    moq: p.moq,
    sold: p.soldCount,
    customizable: p.isCustomizable,
    location: p.supplier?.companyName ?? 'Bangladesh',
    category: p.category?.slug ?? 'other',
    thumbnailUrl: p.thumbnailUrl ?? null,
    unit: p.unit ?? null,
    ratingAvg: p.ratingAvg ?? null,
    reviewCount: p.reviewCount ?? null,
    supplierName: p.supplier?.companyName ?? null,
    supplierVerified: p.supplier?.verificationStatus === 'approved',
  }
}

export function FeaturedProducts() {
  const { setCurrentPage } = useNavigationStore()
  const [products, setProducts] = useState<MainProduct[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/products?page=1&limit=12&sortBy=soldCount&sortOrder=desc')
      .then(r => r.json())
      .then(body => {
        if (cancelled) return
        const items = Array.isArray(body.data) ? body.data : (body.data?.products ?? [])
        setProducts(items.map(mapApiProduct))
      })
      .catch(() => { if (!cancelled) setProducts([]) })
    return () => { cancelled = true }
  }, [])

  return (
    <section>
      {/* Section header: red bar + title + View All */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1 rounded-full" style={{ background: '#E31C3D' }} aria-hidden />
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">Featured Products</h2>
        </div>
        <button
          onClick={() => setCurrentPage('all-products')}
          className="inline-flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all"
          style={{ color: '#E31C3D' }}
        >
          View All <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* 6-col grid per mockup */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {products === null
          ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products.map(p => <MainProductCard key={p.id} product={p} />)}
      </div>
    </section>
  )
}
