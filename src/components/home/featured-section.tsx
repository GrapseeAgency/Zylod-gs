'use client'

import React, { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { ProductCard, type HomeProduct } from './product-card'

/* ════════════════════════════════════════════════════════════════════
   Featured Products — 1:1 exact match against user reference mockup.
   12 products across 6 columns x 2 rows with exact names, prices,
   units, MOQs, suppliers, gold stars with (+) counts, and verified badges.
   ════════════════════════════════════════════════════════════════════ */

const MOCKUP_PRODUCTS: HomeProduct[] = [
  {
    id: 'prod-cotton-fabric',
    name: 'Premium Cotton\nFabric - Dyed 44"',
    price: 320,
    moq: 100,
    unit: 'yard',
    supplierName: 'Dhaka Textile Mills Ltd',
    supplierVerified: true,
    ratingAvg: 4.8,
    reviewCount: 120,
    thumbnailUrl: '/images/products/cotton-fabric.png',
    isFavorited: false,
  },
  {
    id: 'prod-denim-fabric',
    name: 'Export Quality Denim\nFabric 12oz',
    price: 480,
    moq: 200,
    unit: 'yard',
    supplierName: 'Dhaka Textile Mills Ltd',
    supplierVerified: true,
    ratingAvg: 4.7,
    reviewCount: 96,
    thumbnailUrl: '/images/products/denim-fabric.png',
    isFavorited: false,
  },
  {
    id: 'prod-silk-fabric',
    name: 'Pure Silk Fabric -\nHandloom',
    price: 1250,
    moq: 50,
    unit: 'yard',
    supplierName: 'Dhaka Textile Mills Ltd',
    supplierVerified: true,
    ratingAvg: 4.9,
    reviewCount: 76,
    thumbnailUrl: '/images/products/silk-fabric.png',
    isFavorited: false,
  },
  {
    id: 'prod-towels',
    name: 'Cotton Bath Towels -\n6pc Bundle',
    price: 850,
    moq: 20,
    unit: 'set',
    supplierName: 'Dhaka Agro Foods Ltd',
    supplierVerified: true,
    ratingAvg: 4.6,
    reviewCount: 60,
    thumbnailUrl: '/images/products/towels.png',
    isFavorited: false,
  },
  {
    id: 'prod-basmati-rice',
    name: 'Premium Basmati\nRice - 50kg Bag',
    price: 4200,
    moq: 10,
    unit: 'bag',
    supplierName: 'Bengal Agro Ltd',
    supplierVerified: true,
    ratingAvg: 4.8,
    reviewCount: 110,
    thumbnailUrl: '/images/products/basmati-rice.png',
    isFavorited: false,
  },
  {
    id: 'prod-jute-bag-1',
    name: 'Natural Jute Tote\nBags - 100pcs Bale',
    price: 18,
    moq: 1000,
    unit: 'piece',
    supplierName: 'GreenLife Packaging',
    supplierVerified: true,
    ratingAvg: 4.5,
    reviewCount: 52,
    thumbnailUrl: '/images/products/jute-shopping-bags.png',
    isFavorited: false,
  },
  {
    id: 'prod-kataribhog-rice',
    name: 'Aromatic Kataribhog\nRice - 25kg',
    price: 2600,
    moq: 20,
    unit: 'bag',
    supplierName: 'Bengal Agro Ltd',
    supplierVerified: true,
    ratingAvg: 4.7,
    reviewCount: 88,
    thumbnailUrl: '/images/products/kataribhog-rice-sacks.png',
    isFavorited: false,
  },
  {
    id: 'prod-galaxy-s24',
    name: 'Smartphone Galaxy\nS24 - Wholesale Lot',
    price: 92000,
    moq: 5,
    unit: 'piece',
    supplierName: 'SmartTech Distribution',
    supplierVerified: true,
    ratingAvg: 4.6,
    reviewCount: 22,
    thumbnailUrl: '/images/products/galaxy-s24.png',
    isFavorited: false,
  },
  {
    id: 'prod-iphone-15',
    name: 'iPhone 15 - Bulk\nImport Carton',
    price: 118000,
    moq: 5,
    unit: 'piece',
    supplierName: 'SmartTech Distribution',
    supplierVerified: true,
    ratingAvg: 4.8,
    reviewCount: 67,
    thumbnailUrl: '/images/products/iphone-15.png',
    isFavorited: false,
  },
  {
    id: 'prod-solar-powerbank',
    name: 'Solar Power Bank\n20000mAh',
    price: 2350,
    moq: 50,
    unit: 'piece',
    supplierName: 'GreenTech Solutions',
    supplierVerified: true,
    ratingAvg: 4.8,
    reviewCount: 95,
    thumbnailUrl: '/images/products/solar-powerbank.png',
    isFavorited: false,
  },
  {
    id: 'prod-jute-bag-2',
    name: 'Natural Jute Tote\nBags - 100pcs Bale',
    price: 18,
    moq: 1000,
    unit: 'piece',
    supplierName: 'GreenLife Packaging',
    supplierVerified: true,
    ratingAvg: 4.6,
    reviewCount: 73,
    thumbnailUrl: '/images/products/jute-shopping-bags.png',
    isFavorited: false,
  },
  {
    id: 'prod-led-bulb',
    name: 'LED Bulb 9W\n- Energy Saving',
    price: 45,
    moq: 100,
    unit: 'piece',
    supplierName: 'LightHub Bangladesh',
    supplierVerified: true,
    ratingAvg: 4.7,
    reviewCount: 85,
    thumbnailUrl: '/images/products/led-bulb-9w.png',
    isFavorited: false,
  },
]

export function FeaturedSection() {
  const { navigate } = useNavigationStore()
  const [products, setProducts] = useState<HomeProduct[]>(MOCKUP_PRODUCTS)

  useEffect(() => {
    let cancelled = false

    const loadWishlist = async () => {
      // Signed-in: seed real wishlist hearts
      if (useAuthStore.getState().isAuthenticated) {
        try {
          const favRes = await fetch('/api/favorites', { credentials: 'include' })
          if (favRes.ok && !cancelled) {
            const favBody = await favRes.json()
            const list: Array<{ product?: { id?: string } }> = Array.isArray(favBody.data) ? favBody.data : []
            const favIds = new Set(list.map((f) => f.product?.id).filter(Boolean) as string[])
            if (favIds.size > 0) {
              setProducts((prev) =>
                prev.map((p) => (favIds.has(p.id) ? { ...p, isFavorited: true } : p))
              )
            }
          }
        } catch {
          // Keep default wishlist state
        }
      }
    }

    loadWishlist()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section aria-labelledby="featured-products-heading">
      {/* Section header — red bar + title + View All (mockup) */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1 rounded-full" style={{ background: '#E31C3D' }} aria-hidden />
          <h2 id="featured-products-heading" className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Featured products
          </h2>
        </div>
        <button
          onClick={() => navigate('category-products', { category: 'all' })}
          className="group inline-flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all"
          style={{ color: '#E31C3D' }}
        >
          View All <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      </div>

      {/* Grid — 6 columns x 2 rows (1:1 exact match against reference mockup) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-2.5 sm:gap-3 xl:gap-3.5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
