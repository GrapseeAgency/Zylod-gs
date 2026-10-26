'use client'

import React, { useState, useCallback } from 'react'
import { Package, MapPin, Star, Heart, BadgeCheck, Store } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'
import { ProductQRCodeTrigger } from '@/components/shared/product-qr-code'
import { ProductShareDialogTrigger } from '@/components/shared/product-share-dialog'

/* ─── Color Constants ─── */
const RED = '#E31C3D'
const VERIFIED_GREEN = '#059669'

/* ─── Product Color Themes (for image placeholder) ─── */
const PRODUCT_COLORS: Record<string, { bg: string; accent: string }> = {
  'p-1': { bg: 'linear-gradient(135deg, #FFE0E0, #FFF5F5)', accent: RED },
  'p-2': { bg: 'linear-gradient(135deg, #E8F5E9, #F1F8E9)', accent: '#388E3C' },
  'p-3': { bg: 'linear-gradient(135deg, #ECEFF1, #CFD8DC)', accent: '#37474F' },
  'p-4': { bg: 'linear-gradient(135deg, #FFF8E1, #FFECB3)', accent: '#F57C00' },
  'p-5': { bg: 'linear-gradient(135deg, #F3E5F5, #E1BEE7)', accent: '#7B1FA2' },
  'p-6': { bg: 'linear-gradient(135deg, #E0F2F1, #B2DFDB)', accent: '#00897B' },
  'p-7': { bg: 'linear-gradient(135deg, #FBE9E7, #FFCCBC)', accent: RED },
  'p-8': { bg: 'linear-gradient(135deg, #FCE4EC, #F8BBD0)', accent: '#AD1457' },
  'p-9': { bg: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)', accent: '#EF6C00' },
  'p-10': { bg: 'linear-gradient(135deg, #FCE4EC, #F8BBD0)', accent: '#C62828' },
  'p-11': { bg: 'linear-gradient(135deg, #ECEFF1, #CFD8DC)', accent: '#37474F' },
  'p-12': { bg: 'linear-gradient(135deg, #FBE9E7, #FFCCBC)', accent: '#D84315' },
  'p-13': { bg: 'linear-gradient(135deg, #FFF8E1, #FFECB3)', accent: '#F57C00' },
  'p-14': { bg: 'linear-gradient(135deg, #F3E5F5, #E1BEE7)', accent: '#7B1FA2' },
  'p-15': { bg: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)', accent: '#2E7D32' },
}

/* ─── Type (t210: extended to carry unit / rating / verified / supplierName) ─── */
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
  const colorTheme = PRODUCT_COLORS[product.id] || { bg: 'linear-gradient(135deg, #F5F5F5, #E0E0E0)', accent: '#9E9E9E' }

  const discountPercent = Math.round(((product.originalPrice - product.price) / Math.max(product.originalPrice, 1)) * 100)
  const rating = product.ratingAvg && product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : null
  const reviews = product.reviewCount || 0

  const handleWishlistToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    // Guest wall — same contract as PDP wishlist toggle: account required.
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
        headers: { 'Content-Type': 'application/json' },
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
      className="group bg-card rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-200 hover:-translate-y-1.5 hover:shadow-lg hover:border-red-200"
    >
      {/* Product Image Area — square aspect per mockup */}
      <div
        className="relative aspect-square flex items-center justify-center cursor-pointer overflow-hidden"
        style={{ background: colorTheme.bg }}
        onClick={() => setCurrentPage('product-detail', { productId: product.id })}
      >
        {/* Badges */}
        {product.customizable && (
          <span className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-semibold text-white bg-green-600 rounded-md shadow-sm">Customizable</span>
        )}
        {discountPercent > 0 && (
          <span
            className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-bold text-white rounded-md shadow-sm"
            style={{ background: RED }}
          >
            -{discountPercent}%
          </span>
        )}

        {/* Heart icon (top-right) — t210: real wishlist toggle, not a fake */}
        <button
          onClick={handleWishlistToggle}
          disabled={toggling}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
          className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${wished ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-gray-500'}`}
          />
        </button>

        {/* Product image — the REAL photo when the supplier filed one,
            icon placeholder only as an honest fallback */}
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="h-full w-full object-cover dark:brightness-[0.92] group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110"
            style={{ background: `${colorTheme.accent}20` }}
          >
            <Package className="h-8 w-8" style={{ color: colorTheme.accent }} />
          </div>
        )}

        {/* QR + Share buttons */}
        <div
          className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <ProductQRCodeTrigger productId={product.id} productName={product.name} />
          <ProductShareDialogTrigger productId={product.id} productName={product.name} productPrice={product.price} />
        </div>
      </div>
      <div className="p-3 cursor-pointer" onClick={() => setCurrentPage('product-detail', { productId: product.id })}>
        {/* Title — 2 line clamp */}
        <p className="text-xs text-gray-800 dark:text-gray-200 font-semibold leading-tight line-clamp-2 h-8 mb-1.5 group-hover:text-red-600 transition-colors">{product.name}</p>

        {/* Price + unit — t210: matches mockup "৳320 / yard" */}
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-sm font-bold" style={{ color: RED }}>
            {formatPrice(product.price)}
          </span>
          {product.unit && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">/ {product.unit}</span>
          )}
          {product.originalPrice > product.price && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 line-through ml-auto">{formatPrice(product.originalPrice)}</span>
          )}
        </div>

        {/* MOQ + sold */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">
          <span className="font-medium">MOQ: {product.moq}{product.unit ? ` ${product.unit}` : ''}</span>
          <span className="font-medium">{product.sold >= 1000 ? `${(product.sold / 1000).toFixed(1)}k` : product.sold} sold</span>
        </div>

        {/* Rating — t210: real ratingAvg + reviewCount from API */}
        {rating && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">{rating}</span>
            <span>({reviews}{reviews >= 100 ? '+' : ''})</span>
          </div>
        )}

        {/* Supplier + verified badge — t210: real supplier name + isVerified */}
        <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
          <Store className="h-3 w-3 shrink-0" />
          <span className="truncate flex-1">{product.supplierName || product.location}</span>
          {product.supplierVerified && (
            <span className="inline-flex items-center gap-0.5 shrink-0 font-semibold" style={{ color: VERIFIED_GREEN }}>
              <BadgeCheck className="h-3 w-3" />
              Verified
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
