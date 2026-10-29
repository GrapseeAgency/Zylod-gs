'use client'

import React, { useState, useCallback } from 'react'
import { Star, Heart } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

/* ════════════════════════════════════════════════════════════════════
   Product card — 1:1 exact match against user's reference mockup.

   Anatomy (top → bottom):
   • Product photo with red-outline heart button in top-right
   • 2-line title (13px, font-semibold, text-gray-900)
   • ৳ price in bold crimson (#E31C3D) + / unit in gray (text-gray-400)
   • MOQ line (11px, text-gray-400)
   • Supplier with circular building icon (11px, text-gray-400)
   • Gold star rating (4.8 (120+)) with + sign
   • Green shield with white checkmark + "Verified Supplier" (11px, text-emerald-600)
   ════════════════════════════════════════════════════════════════════ */

const RED = '#E31C3D'
const VERIFIED_GREEN = '#059669'
const STAR_AMBER = '#F59E0B'

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

function SupplierStoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="8" cy="8" r="6.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 11.5V7.5L8 5.5L11 7.5V11.5H5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <rect x="7" y="8.5" width="2" height="3" fill="currentColor" />
    </svg>
  )
}

function VerifiedShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M8 1.5L13.5 3.8V7.5C13.5 11 11.2 13.8 8 14.8C4.8 13.8 2.5 11 2.5 7.5V3.8L8 1.5Z"
        fill="#059669"
      />
      <path
        d="M5.5 8L7.2 9.7L10.5 6.4"
        stroke="#FFFFFF"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProductCard({ product }: { product: HomeProduct }) {
  const { navigate } = useNavigationStore()
  const { isAuthenticated } = useAuthStore()
  const { toast } = useToast()
  const [wished, setWished] = useState<boolean>(Boolean(product.isFavorited))
  const [toggling, setToggling] = useState(false)

  // t223 honesty: no fabricated rating/review/supplier fallbacks — an
  // unrated product shows "New", a zero-review product hides the count,
  // a missing supplier shows an em-dash, and the Verified chip only
  // renders when the supplier is ACTUALLY verified.
  const hasRating = typeof product.ratingAvg === 'number' && product.ratingAvg > 0
  const rating = hasRating ? product.ratingAvg!.toFixed(1) : null
  const reviews = typeof product.reviewCount === 'number' && product.reviewCount > 0 ? product.reviewCount : null
  const showVerified = product.supplierVerified === true

  const handleWishlistToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
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
      className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5"
    >
      {/* Photo Container — clean by default per reference; heart reveals on hover.
          t229h image-preview fix: the tile stays LIGHT in BOTH modes (white
          product photos get a seamless white tile in dark mode too — the
          standard Amazon/Alibaba dark-mode treatment) and the art is
          object-CONTAIN so no product is ever cropped by the square frame. */}
      <div className="relative aspect-square bg-[#F7F8FA] dark:bg-[#F7F8FA] overflow-hidden flex items-center justify-center p-2 sm:p-2.5">
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              if (!target.src.includes('placeholder')) {
                target.src = '/placeholder-product.svg'
              }
            }}
          />
        ) : (
          <img
            src="/placeholder-product.svg"
            alt={product.name}
            className="h-10 w-10 opacity-30"
          />
        )}
        <button
          onClick={handleWishlistToggle}
          disabled={toggling}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
          className={cn(
            'absolute top-2 right-2 h-6 w-6 rounded-full bg-white dark:bg-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.14)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-150 disabled:opacity-50',
            wished ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <Heart
            className={cn(
              'h-3.5 w-3.5 transition-colors',
              wished ? 'fill-[#E31C3D] text-[#E31C3D]' : 'text-[#E31C3D] fill-none'
            )}
            strokeWidth={1.8}
            aria-hidden
          />
        </button>
      </div>

      {/* Body */}
      <div className="px-2.5 pt-2 pb-2.5 sm:px-3">
        {/* Title — 2 lines matching reference (t229c: sized for the 4/5-col
            desktop grid — the old 10px micro-type matched the retired
            6-col thumbnail grid the owner flagged as a preview-size bug) */}
        <h3 className="text-[11px] sm:text-xs xl:text-[13px] 2xl:text-[13.5px] font-semibold leading-[1.22] text-gray-900 dark:text-gray-100 h-[32px] xl:h-[36px] line-clamp-2 mb-1 tracking-tight whitespace-pre-line">
          {product.name}
        </h3>

        {/* Price & Unit */}
        <p className="flex items-baseline mb-0.5 whitespace-nowrap overflow-hidden">
          <span className="text-[15px] xl:text-[17px] 2xl:text-[18px] font-extrabold leading-none tracking-tight" style={{ color: RED }}>
            ৳{product.price.toLocaleString()}
          </span>
          {product.unit && (
            <span className="text-[10.5px] xl:text-[11.5px] font-normal text-gray-400 dark:text-gray-500 ml-1">
              / {product.unit}
            </span>
          )}
        </p>

        {/* MOQ */}
        <p className="text-[10.5px] xl:text-[11.5px] font-normal text-gray-400 dark:text-gray-500 mb-1 whitespace-nowrap truncate">
          MOQ: {product.moq} {product.unit || 'piece'}
        </p>

        {/* Supplier with circular building icon */}
        <p className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1 min-w-0">
          <SupplierStoreIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="text-[10.5px] xl:text-[11.5px] truncate">{product.supplierName || '—'}</span>
        </p>

        {/* Rating with gold star — real ratings only, "New" when unrated */}
        <p className="flex items-center gap-1 mb-1 whitespace-nowrap">
          {rating ? (
            <>
              <Star className="h-3 w-3 shrink-0" style={{ color: STAR_AMBER, fill: STAR_AMBER }} aria-hidden />
              <span className="text-[10.5px] xl:text-[11.5px] font-semibold text-gray-700 dark:text-gray-300">
                {rating}
              </span>
              {reviews !== null && (
                <span className="text-[10.5px] xl:text-[11.5px] text-gray-400 dark:text-gray-500">
                  ({reviews}+)
                </span>
              )}
            </>
          ) : (
            <span className="text-[10.5px] xl:text-[11.5px] font-medium text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-px">
              New
            </span>
          )}
        </p>

        {/* Verified Supplier chip — only when actually verified */}
        {showVerified && (
          <p className="flex items-center gap-1 whitespace-nowrap">
            <VerifiedShieldIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10.5px] xl:text-[11.5px] font-semibold" style={{ color: VERIFIED_GREEN }}>
              Verified Supplier
            </span>
          </p>
        )}
      </div>
    </article>
  )
}
