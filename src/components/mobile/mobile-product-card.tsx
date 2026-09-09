'use client'

import { useCurrencyStore } from '@/store/currency-store'
import { useNavigationStore } from '@/store/navigation-store'
import Image from 'next/image'
import type { Product } from '@/store/product-store'

interface MobileProductCardProps {
  product: Product
}

export function MobileProductCard({ product }: MobileProductCardProps) {
  const { formatPrice } = useCurrencyStore()
  const { navigate } = useNavigationStore()

  const hasImage = product.images?.[0] && !product.images[0].startsWith('/placeholder')

  const handleCardClick = () => {
    navigate('product-detail', { productId: product.id })
  }

  return (
    <div
      className="w-full text-left bg-card rounded-md overflow-hidden transition-all active:scale-[0.98]"
      onClick={handleCardClick}
    >
      {/* Image - slightly taller than wide, like reference ~5:6 */}
      <div className="relative overflow-hidden bg-white" style={{ aspectRatio: '5/6' }}>
        {hasImage ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 180px"
          />
        ) : (
          <div className="w-full h-full bg-white" />
        )}
      </div>

      {/* Content - compact text block */}
      <div className="px-1.5 pt-1 pb-1.5">
        <h5 className="text-[10px] text-foreground line-clamp-2 leading-[13px] font-medium">
          {product.name}
        </h5>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-primary font-bold text-[11px]">{formatPrice(product.price)}</span>
          {product.soldCount > 0 && (
            <span className="text-muted-foreground text-[8px]">{product.soldCount >= 1000 ? `${Math.floor(product.soldCount / 1000)}k` : product.soldCount} sold</span>
          )}
        </div>
      </div>
    </div>
  )
}
