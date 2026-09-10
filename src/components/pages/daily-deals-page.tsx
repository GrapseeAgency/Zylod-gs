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
  Sun,
  Zap,
  Loader2,
  AlertTriangle,
  ShoppingCart,
} from 'lucide-react'

interface DailyDeal {
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
  supplierName: string
  supplierId: string
  supplierVerified: boolean
  endAt: string
}

export function DailyDealsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const [deals, setDeals] = useState<DailyDeal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState(Date.now())

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/deals?type=daily&limit=20')
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setDeals(json.data.dailyDeals)
        } else if (!cancelled) {
          setLoadError('Daily deals are unavailable right now.')
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

  // Live countdown to the end of the deal day (real expiry from the API)
  useEffect(() => {
    if (deals.length === 0) return
    const timer = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [deals.length])

  // Highest discount leads the page as Deal of the Day
  const sortedDeals = useMemo(
    () => [...deals].sort((a, b) => b.discountPercent - a.discountPercent),
    [deals]
  )
  const heroDeal = sortedDeals[0]
  const restDeals = sortedDeals.slice(1)

  const endsAt = useMemo(() => {
    if (sortedDeals.length === 0) return null
    return new Date(sortedDeals[0].endAt)
  }, [sortedDeals])

  const hoursLeft = endsAt ? Math.max(0, Math.floor((endsAt.getTime() - nowTs) / 3600000)) : null

  const handleAddToCart = (e: React.MouseEvent, deal: DailyDeal) => {
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
      description: `Today's deal price applied — MOQ ${deal.moq} ${deal.unit}.`,
    })
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 md:pb-8">
      {/* ─── Top Nav Bar ─── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E0E0E0] h-14 flex items-center justify-between px-4 md:hidden">
        <button
          onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-[#C8102E]" />
        </button>
        <span className="text-lg font-bold text-[#C8102E]">Zylod</span>
        <button
          onClick={() => navigate('help-center')}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5 text-[#6B7280]" />
        </button>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-6 md:max-w-5xl md:px-6 md:pt-8">
        {/* ─── Editorial Headline ─── */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-serif font-black text-[#1A1A1A] tracking-tight">
            Curated Daily Deals
          </h1>
          <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
            Exclusive wholesale lots, available for 24 hours.
            {hoursLeft !== null && hoursLeft > 0 && ` ${hoursLeft}h left today.`}
          </p>
        </div>

        {/* ─── Loading State ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280]">Loading today&apos;s deals...</p>
          </div>
        )}

        {/* ─── Error / Empty States ─── */}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}

        {!isLoading && !loadError && deals.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Sun className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-[#6B7280] max-w-[260px]">
              Today&apos;s picks have sold out. A fresh selection drops at midnight.
            </p>
            <button
              onClick={() => navigate('flash-deals')}
              className="mt-1 px-4 py-2 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-semibold rounded-lg"
            >
              Browse Flash Deals
            </button>
          </div>
        )}

        {/* ─── Deal of the Day Card ─── */}
        {heroDeal && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('product-detail', { productId: heroDeal.productId })}
            className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer md:max-w-3xl md:mx-auto md:w-full"
          >
            <div className="relative aspect-[16/10] w-full bg-gray-100">
              {heroDeal.productThumbnail ? (
                 
                <img
                  src={heroDeal.productThumbnail}
                  alt={heroDeal.productName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Sun className="h-10 w-10 text-gray-300" />
                </div>
              )}
            </div>

            <div className="p-4 bg-gradient-to-b from-white via-[#FAF4F5] to-white">
              <span className="inline-block bg-[#C8102E] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded mb-2">
                Deal of the Day · -{heroDeal.discountPercent}%
              </span>

              <h2 className="font-serif font-bold text-base text-[#1A1A1A] leading-snug line-clamp-2">
                {heroDeal.productName}
              </h2>

              <div className="flex items-center justify-between mt-3 pt-1">
                <div>
                  <div className="text-xl font-bold text-[#C8102E]">
                    {formatPrice(heroDeal.dealPrice)}
                    <span className="text-xs font-normal text-[#6B7280]"> / {heroDeal.unit}</span>
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    <span className="line-through">{formatPrice(heroDeal.originalPrice)}</span> MSRP · MOQ {heroDeal.moq}
                  </div>
                </div>

                <button
                  onClick={(e) => handleAddToCart(e, heroDeal)}
                  className="px-5 py-2.5 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Section: Today's Picks ─── */}
        {restDeals.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sun className="h-4 w-4 text-[#F59E0B]" />
              <h2 className="text-lg font-serif font-bold text-[#1A1A1A]">Today&apos;s Picks</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {restDeals.map((deal, idx) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate('product-detail', { productId: deal.productId })}
                  className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="relative aspect-[16/8] w-full bg-gray-100">
                    {deal.productThumbnail ? (
                       
                      <img src={deal.productThumbnail} alt={deal.productName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                    <span className="absolute top-3 right-3 bg-[#C8102E] text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded shadow">
                      -{deal.discountPercent}%
                    </span>
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-sm text-[#1A1A1A] line-clamp-1">{deal.productName}</h3>
                    <div className="text-base font-bold text-[#C8102E] mt-1">
                      {formatPrice(deal.dealPrice)}
                      <span className="text-xs font-normal text-[#6B7280]"> / {deal.unit}</span>{' '}
                      <span className="text-xs font-normal text-gray-400 line-through">{formatPrice(deal.originalPrice)}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6B7280] mt-2 pt-2 border-t border-gray-100">
                      <span>MOQ: {deal.moq} {deal.unit}</span>
                      <button
                        onClick={(e) => handleAddToCart(e, deal)}
                        className="font-semibold text-[#C8102E] hover:text-[#A50D24]"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Cross-link: Flash Deals ─── */}
        {!isLoading && deals.length > 0 && (
          <button
            onClick={() => navigate('flash-deals')}
            className="w-full md:max-w-3xl md:mx-auto bg-[#1E1E1E] rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:border-[#FF4D6D]/40 border border-transparent transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-[#C8102E]/20 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-[#FF4D6D]" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white">Flash Deals live now</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Steeper cuts, ticking clock — while stock lasts.</p>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

export default DailyDealsPage
