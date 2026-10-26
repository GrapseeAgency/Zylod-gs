'use client'

import React, { useState, useCallback } from 'react'
import { Star, Heart, BadgeCheck, Building2 } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'

/* ════════════════════════════════════════════════════════════════════
   Product card — hand-built to the owner's mockup (t211).

   Anatomy (top → bottom): photo with wishlist heart → 2-line title →
   red price + "/ unit" → MOQ → supplier with building icon → gold-star
   rating → green "Verified Supplier". Whole card opens the real PDP.
   Heart hits the real wishlist API; guests hit the account wall.
   ════════════════════════════════════════════════════════════════════ */

const RED = '#E31C3D'
const VERIFIED_GREEN = '#059669'
const STAR_YELLOW = '#F59E0B'

export interface HomeProduct {
  id: string
  name: string
  price: number
  moq: number
  unit?: string | null
  ratingAvg?: number | null
  reviewCount?: number | null
  thumbnailUrl?: string | null
  supplierName?: string | null
  supplierVerified?: boolean | null
  isFavorited?: boolean
}

export function ProductCard({ product }: { product: HomeProduct }) {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { isAuthenticated } = useAuthStore()
  const { toast } = useToast()
  const [wished, setWished] = useState<boolean>(Boolean(product.isFavorited))
  const [toggling, setToggling] = useState(false)

  const rating = product.ratingAvg && product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : null
  const reviews = product.reviewCount || 0

  const handleWishlistToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      // Guest wall — an account is required to save products (money-path rule).
      if (!isAuthenticated) {
        toast({ title: 'Sign in required', description: 'Create a Zylod account to save products to your wishlist.' })
        navigate('login')
        return
      }
      setToggling(true)
      try {
        const res = await fetch(`/api/favorites/${product.id}`, {
          method: wished ? 'DELETE' : 'POST',
          credentials: 'include',
        })
        if (res.ok) {
          setWished((w) => !w)
          toast({ title: wished ? 'Removed from Wishlist' : 'Added to Wishlist', description: product.name })
        } else if (res.status === 401) {
          navigate('login')
        } else {
          toast({ title: 'Could not update wishlist', variant: 'destructive' })
        }
      } catch {
        toast({ title: 'Network error', variant: 'destructive' })
      } finally {
        setToggling(false)
      }
    },
    [isAuthenticated, product.id, product.name, wished, navigate, toast]
  )

  return (
    <article
      onClick={() => navigate('product-detail', { productId: product.id })}
      className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-[0_10px_28px_rgba(0,0,0,0.09)] hover:-translate-y-0.5"
    >
      {/* Photo + heart */}
      <div className="relative aspect-[5/4] bg-[#F6F7F9] dark:bg-gray-800 overflow-hidden">
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-300 dark:text-gray-600">
            No photo
          </div>
        )}
        <button
          onClick={handleWishlistToggle}
          disabled={toggling}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white dark:bg-gray-900 shadow-[0_1px_4px_rgba(0,0,0,0.12)] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
        >
          <Heart
            className={`h-3.5 w-3.5 transition-colors ${wished ? 'fill-red-500 text-red-500' : 'text-gray-300 dark:text-gray-600'}`}
            aria-hidden
          />
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        <h3 className="text-[13px] font-bold leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 min-h-[38px] mb-1.5">
          {product.name}
        </h3>

        {/* Price + unit */}
        <p className="flex items-baseline gap-1 mb-1">
          <span className="text-[17px] font-extrabold leading-none" style={{ color: RED }}>
            {formatPrice(product.price)}
          </span>
          {product.unit && (
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">/ {product.unit}</span>
          )}
        </p>

        {/* MOQ */}
        <p className="text-[11px] text-gray-500 dark:text-gray-500 mb-1.5">
          MOQ: {product.moq}
          {product.unit ? ` ${product.unit}` : ''}
        </p>

        {/* Supplier */}
        <p className="flex items-center gap-1 text-gray-500 dark:text-gray-500 mb-1">
          <Building2 className="h-3 w-3 shrink-0" aria-hidden />
          <span className="text-[11px] truncate">{product.supplierName || 'Bangladesh'}</span>
        </p>

        {/* Rating */}
        {rating && (
          <p className="flex items-center gap-1 mb-1">
            <Star className="h-3 w-3 shrink-0" style={{ color: STAR_YELLOW, fill: STAR_YELLOW }} aria-hidden />
            <span className="text-[11px] text-gray-600 dark:text-gray-400">
              <span className="font-semibold">{rating}</span>
              {reviews > 0 && <span> ({reviews}{reviews >= 100 ? '+' : ''})</span>}
            </span>
          </p>
        )}

        {/* Verified badge */}
        {product.supplierVerified && (
          <p className="flex items-center gap-1">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: VERIFIED_GREEN }} aria-hidden />
            <span className="text-[11px] font-semibold" style={{ color: VERIFIED_GREEN }}>
              Verified Supplier
            </span>
          </p>
        )}
      </div>
    </article>
  )
}
