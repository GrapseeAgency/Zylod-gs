'use client'

import React, { useState, useCallback } from 'react'
import { Star, Heart, BadgeCheck, Building2 } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'

/* ─── t210-r2: card anatomy 1:1 with the mockup ───
   photo → heart (top-right) → title → RED price + "/unit" → MOQ →
   supplier (building icon) → star rating → green "Verified Supplier". */

export const CARD_RED = '#E31C3D'
const VERIFIED_GREEN = '#059669'
const STAR_YELLOW = '#FBBF24'

export interface MainProduct {
  id: string
  name: string
  price: number
  originalPrice: number
  moq: number
  sold: number
  customizable: boolean
  location: string
  category: string
  thumbnailUrl?: string | null
  unit?: string | null
  ratingAvg?: number | null
  reviewCount?: number | null
  supplierName?: string | null
  supplierVerified?: boolean | null
  isFavorited?: boolean | null
}

export function MainProductCard({ product }: { product: MainProduct }) {
  const { setCurrentPage } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { isAuthenticated } = useAuthStore()
  const { toast } = useToast()
  const [wished, setWished] = useState<boolean>(Boolean(product.isFavorited))
  const [toggling, setToggling] = useState(false)

  const rating = product.ratingAvg && product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : null
  const reviews = product.reviewCount || 0

  const handleWishlistToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    // Guest wall — account required, same contract as the PDP.
    if (!isAuthenticated) {
      toast({ title: 'Sign in required', description: 'Create a Zylod account to save products to your wishlist.' })
      setCurrentPage('login')
      return
    }
    setToggling(true)
    try {
      const res = await fetch(`/api/favorites/${product.id}`, {
        method: wished ? 'DELETE' : 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        setWished(w => !w)
        toast({ title: wished ? 'Removed from Wishlist' : 'Added to Wishlist', description: product.name })
      } else if (res.status === 401) {
        setCurrentPage('login')
      } else {
        toast({ title: 'Could not update wishlist', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setToggling(false)
    }
  }, [isAuthenticated, product.id, product.name, wished, setCurrentPage, toast])

  return (
    <div
      className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 overflow-hidden transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 cursor-pointer"
      onClick={() => setCurrentPage('product-detail', { productId: product.id })}
    >
      {/* Photo */}
      <div className="relative aspect-square bg-[#F6F7F9] dark:bg-gray-800 overflow-hidden">
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-300 dark:text-gray-600">No photo</div>
        )}

        {/* Heart — top-right white circle (mockup) */}
        <button
          onClick={handleWishlistToggle}
          disabled={toggling}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
        >
          <Heart className={`h-3.5 w-3.5 transition-colors ${wished ? 'fill-red-500 text-red-500' : 'text-gray-300 dark:text-gray-600'}`} />
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        {/* Title — 2 lines */}
        <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 min-h-[36px] mb-1.5">
          {product.name}
        </p>

        {/* Price + unit — red bold "/ yard" */}
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-base font-extrabold" style={{ color: CARD_RED }}>
            {formatPrice(product.price)}
          </span>
          {product.unit && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">/ {product.unit}</span>
          )}
        </div>

        {/* MOQ */}
        <p className="text-[11px] text-gray-500 dark:text-gray-500 mb-1.5">
          MOQ: {product.moq}{product.unit ? ` ${product.unit}` : ''}
        </p>

        {/* Supplier */}
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-500 mb-1">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="text-[11px] truncate">{product.supplierName || product.location}</span>
        </div>

        {/* Rating */}
        {rating && (
          <div className="flex items-center gap-1 mb-1">
            <Star className="h-3 w-3 shrink-0" style={{ color: STAR_YELLOW, fill: STAR_YELLOW }} />
            <span className="text-[11px] text-gray-600 dark:text-gray-400">
              {rating} {reviews > 0 && <span>({reviews}{reviews >= 100 ? '+' : ''})</span>}
            </span>
          </div>
        )}

        {/* Verified Supplier */}
        {product.supplierVerified && (
          <div className="flex items-center gap-1">
            <BadgeCheck className="h-3 w-3 shrink-0" style={{ color: VERIFIED_GREEN }} />
            <span className="text-[11px] font-medium" style={{ color: VERIFIED_GREEN }}>Verified Supplier</span>
          </div>
        )}
      </div>
    </div>
  )
}
