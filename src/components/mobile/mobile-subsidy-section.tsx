'use client'

import { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

interface SubsidyProduct {
  id: string
  name: string
  price: number
  image: string | null
}

export function MobileSubsidySection() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [products, setProducts] = useState<SubsidyProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/deals?type=flash&limit=8')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setProducts(json.data.map((d: any) => ({
            id: d.productId,
            name: d.productName || d.product?.name || 'Product',
            price: d.dealPrice || d.product?.basePrice || 0,
            image: d.productThumbnail || d.product?.thumbnailUrl || null,
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="mt-3">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
        <div className="flex items-center gap-0 overflow-x-auto pb-1 -mx-3 px-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {loading ? (
            [1, 2, 3, 4].map(i => <Skeleton key={i} className="flex-none w-[58px] aspect-square rounded-md" />)
          ) : (
            products.map((product, i) => (
              <motion.button
                key={product.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: i * 0.02 }}
                onClick={() => navigate('product-detail', { productId: product.id })}
                className="flex-none w-[58px] text-left transition-all active:scale-[0.97]"
              >
                <div className="relative aspect-square overflow-hidden bg-white rounded-md">
                  {product.image ? (
                     
                    <img src={product.image} alt={product.name} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">📦</div>
                  )}
                </div>
                <span className="text-primary font-bold text-[10px] block pt-0.5 leading-tight truncate">{formatPrice(product.price)}</span>
              </motion.button>
            ))
          )}
        </div>
      </motion.div>
    </section>
  )
}