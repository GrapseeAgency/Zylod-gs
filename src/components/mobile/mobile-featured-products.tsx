'use client'

import { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { ChevronRight, Package } from 'lucide-react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

interface FeaturedProduct {
  id: string
  name: string
  price: number
  moq: number
  sold: number
  rating: number
  thumbnailUrl: string | null
  unit: string
}

export function MobileFeaturedProducts() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [products, setProducts] = useState<FeaturedProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/products?sortBy=soldCount&sortOrder=desc&limit=8')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setProducts(json.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.basePrice,
            moq: p.moq,
            sold: p.soldCount || 0,
            rating: p.ratingAvg || 0,
            thumbnailUrl: p.thumbnailUrl || null,
            unit: p.unit || 'pcs',
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="mt-5">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.45 }}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-base text-foreground">Best Sellers</h4>
          <button onClick={() => navigate('best-sellers')} className="flex items-center gap-0.5 text-primary text-xs font-semibold">
            See All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {loading ? (
            [1, 2, 3, 4].map(i => <Skeleton key={i} className="flex-none w-[150px] h-44 rounded-xl" />)
          ) : (
            products.map((product) => (
              <motion.button
                key={product.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => navigate('product-detail', { productId: product.id })}
                className="flex-none w-[150px] bg-card rounded-xl overflow-hidden border border-border/50 shadow-sm transition-all active:scale-[0.97] text-left"
              >
                <div className="relative h-[100px] flex items-center justify-center bg-muted overflow-hidden">
                  {product.thumbnailUrl ? (
                     
                    <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  )}
                  {product.sold > 0 && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-bold text-white bg-primary rounded">
                      {product.sold >= 1000 ? `${(product.sold / 1000).toFixed(1)}k` : product.sold} sold
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[11px] text-foreground font-medium line-clamp-2 h-7 leading-[14px]">{product.name}</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-primary font-bold text-xs">{formatPrice(product.price)}</span>
                    {product.rating > 0 && <span className="text-[9px] text-muted-foreground">★ {product.rating.toFixed(1)}</span>}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>MOQ: {product.moq >= 1000 ? `${(product.moq / 1000).toFixed(1)}k` : product.moq} {product.unit}</span>
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </motion.div>
    </section>
  )
}
