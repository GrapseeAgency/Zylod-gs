'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import { toast } from 'sonner'
import {
  ArrowLeft,
  HelpCircle,
  ShoppingCart,
  Zap,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

interface FlashDeal {
  id: string
  productId: string
  productName: string
  productSlug: string
  productThumbnail: string | null
  originalPrice: number
  dealPrice: number
  discountPercent: number
  moq: number
  unit: string
  rating: number
  soldCount: number
  totalStock: number
  remainingStock: number
  supplierName: string
  supplierId: string
  supplierVerified: boolean
  endAt: string
}

export function FlashDealsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const [deals, setDeals] = useState<FlashDeal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Countdown target = soonest active deal expiry (real, from the API)
  const endsAt = useMemo(() => {
    if (deals.length === 0) return null
    return deals.reduce((min, d) => (new Date(d.endAt) < min ? new Date(d.endAt) : min), new Date(deals[0].endAt))
  }, [deals])

  const [nowTs, setNowTs] = useState(Date.now())

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/deals?type=flash&limit=20')
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setDeals(json.data.flashDeals)
        } else if (!cancelled) {
          setLoadError('Flash deals are unavailable right now.')
        }
      } catch {
        if (!cancelled) setLoadError('Network error. Please try again.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!endsAt) return
    const timer = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [endsAt])

  const timeLeft = useMemo(() => {
    if (!endsAt) return null
    const diff = Math.max(0, Math.floor((endsAt.getTime() - nowTs) / 1000))
    return {
      hours: Math.floor(diff / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
    }
  }, [endsAt, nowTs])

  const handleAddToCart = (e: React.MouseEvent, deal: FlashDeal) => {
    e.stopPropagation()
    addItem({
      id: deal.productId,
      productId: deal.productId,
      productName: deal.productName,
      productSlug: deal.productSlug,
      productImage: deal.productThumbnail,
      variantId: null,
      variantName: null,
      variantValue: null,
      unitPrice: deal.dealPrice,
      totalPrice: deal.dealPrice * deal.moq,
      quantity: deal.moq,
      moq: deal.moq,
      maxOrderQty: null,
      supplierId: deal.supplierId,
      supplierName: deal.supplierName,
      supplierSlug: deal.supplierId,
      unit: deal.unit,
      priceTiers: [],
    })
    toast.success(`Added ${deal.productName} to cart!`, {
      description: `Flash deal price applied — MOQ ${deal.moq} ${deal.unit}.`,
    })
  }

  const formatDigit = (num: number) => num.toString().padStart(2, '0')

  return (
    <div className="min-h-screen bg-[#121212] text-white pb-24 md:pb-8">
      {/* ─── Top Nav Bar (Dark theme) ─── */}
      <header className="sticky top-0 z-40 bg-[#1A1A1A] border-b border-[#2C2C2C] h-14 flex items-center justify-between px-4">
        <button
          onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors md:hidden"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-[#FF4D6D]" />
        </button>
        <span className="text-lg font-bold text-[#FF4D6D]">Zylod</span>
        <button
          onClick={() => navigate('help-center')}
          className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5 text-gray-400" />
        </button>
      </header>

      <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-6xl px-4 md:px-6 pt-4 md:pt-6 space-y-4 md:space-y-6">
        {/* ─── Dark Flash Deals Header Card ─── */}
        <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-5 text-center shadow-lg relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-[#C8102E]/20 blur-3xl pointer-events-none" />

          <h1 className="text-2xl md:text-3xl font-black tracking-widest text-[#FF4D6D] uppercase">
            Flash Deals
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
            Premium B2B inventory at lowest prices. Limited stock. Offers expire soon.
          </p>

          {/* Countdown timer container */}
          {timeLeft && (
            <div className="bg-[#121212]/90 border border-[#333333] rounded-xl p-3 mt-4">
              <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase block mb-2">
                Ends In
              </span>
              <div className="flex items-center justify-center gap-2">
                <div className="bg-[#242424] border border-[#383838] rounded-lg px-3 py-1.5 min-w-[56px] text-center">
                  <span className="text-lg font-black text-white">{formatDigit(timeLeft.hours)}</span>
                  <span className="text-[9px] font-bold text-gray-400 block tracking-wider">HOURS</span>
                </div>
                <span className="text-[#FF4D6D] font-bold text-lg">:</span>
                <div className="bg-[#242424] border border-[#383838] rounded-lg px-3 py-1.5 min-w-[56px] text-center">
                  <span className="text-lg font-black text-white">{formatDigit(timeLeft.minutes)}</span>
                  <span className="text-[9px] font-bold text-gray-400 block tracking-wider">MINS</span>
                </div>
                <span className="text-[#FF4D6D] font-bold text-lg">:</span>
                <div className="bg-[#242424] border border-[#383838] rounded-lg px-3 py-1.5 min-w-[56px] text-center">
                  <span className="text-lg font-black text-[#FF4D6D]">{formatDigit(timeLeft.seconds)}</span>
                  <span className="text-[9px] font-bold text-gray-400 block tracking-wider">SECS</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Loading State ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="w-7 h-7 text-[#FF4D6D] animate-spin" />
            <p className="text-sm text-gray-400">Loading live deals...</p>
          </div>
        )}

        {/* ─── Error / Empty States ─── */}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertTriangle className="w-8 h-8 text-[#FF4D6D]" />
            <p className="text-sm text-gray-300">{loadError}</p>
          </div>
        )}

        {!isLoading && !loadError && deals.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Zap className="w-8 h-8 text-gray-500" />
            <p className="text-sm text-gray-400 max-w-[260px]">
              No flash deals are running right now. Check back soon — new drops go live regularly.
            </p>
            <button
              onClick={() => navigate('daily-deals')}
              className="mt-1 px-4 py-2 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-semibold rounded-lg"
            >
              Browse Daily Deals
            </button>
          </div>
        )}

        {/* ─── Flash Deal Cards ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {deals.map((deal, idx) => {
          const claimedPercent = deal.totalStock > 0
            ? Math.min(100, Math.round(((deal.totalStock - deal.remainingStock) / deal.totalStock) * 100))
            : 100
          const stockText = claimedPercent >= 85
            ? 'Almost Gone'
            : claimedPercent >= 40
              ? `${claimedPercent}% Claimed`
              : `Only ${deal.remainingStock} left`

          return (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => navigate('product-detail', { productId: deal.productId })}
              className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl overflow-hidden shadow-md cursor-pointer hover:border-[#FF4D6D]/40 transition-colors"
            >
              {/* Product image with badge */}
              <div className="relative aspect-[16/9] w-full bg-[#121212]">
                {deal.productThumbnail ? (
                   
                  <img src={deal.productThumbnail} alt={deal.productName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Zap className="h-10 w-10 text-gray-700" />
                  </div>
                )}
                <span className="absolute top-3 right-3 bg-[#C8102E] text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded shadow">
                  -{deal.discountPercent}%
                </span>
              </div>

              <div className="p-4">
                <h3 className="font-bold text-white text-sm leading-snug line-clamp-2">
                  {deal.productName}
                </h3>

                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-lg font-black text-white">
                    {formatPrice(deal.dealPrice)}
                  </span>
                  <span className="text-xs text-gray-500 line-through">
                    {formatPrice(deal.originalPrice)}
                  </span>
                  <span className="text-[11px] text-gray-400">/ {deal.unit}</span>
                </div>

                {/* Stock level progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                    <span>Stock Level</span>
                    <span className="text-gray-300 font-semibold">{stockText}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#2C2C2C] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#C8102E] rounded-full"
                      style={{ width: `${claimedPercent}%` }}
                    />
                  </div>
                </div>

                {/* Add to Cart button */}
                <button
                  onClick={(e) => handleAddToCart(e, deal)}
                  className="w-full mt-4 h-11 bg-[#C8102E] hover:bg-[#A50D24] active:scale-[0.98] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart · MOQ {deal.moq} {deal.unit}
                </button>
              </div>
            </motion.div>
          )
        })}
        </div>
      </div>
    </div>
  )
}

export default FlashDealsPage
