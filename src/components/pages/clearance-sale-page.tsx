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
  Loader2,
  AlertTriangle,
  Percent,
} from 'lucide-react'

interface ClearanceProduct {
  id: string
  name: string
  basePrice: number
  unit: string | null
  moq: number
  stockQuantity: number
  thumbnailUrl: string | null
  images?: { imageUrl: string }[]
  category?: { name: string; slug: string } | null
  supplier?: { id: string; companyName: string } | null
}

export function ClearanceSalePage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const [items, setItems] = useState<ClearanceProduct[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const qs = activeTab === 'all' ? '' : `&category=${encodeURIComponent(activeTab)}`
        const res = await fetch(`/api/products?clearance=true&limit=13${qs}`)
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setItems(json.data)
        } else if (!cancelled) {
          setLoadError('Clearance listings are unavailable right now.')
        }
      } catch {
        if (!cancelled) setLoadError('Network error. Please try again.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [activeTab])

  // Tabs derived from the actual clearance catalog
  const tabs = useMemo(() => {
    const seen = new Map<string, string>()
    items.forEach((it) => {
      if (it.category?.slug && !seen.has(it.category.slug)) {
        seen.set(it.category.slug, it.category.name.replace(/ & .*/, ''))
      }
    })
    return [{ slug: 'all', label: 'All Clearance' }, ...Array.from(seen, ([slug, label]) => ({ slug, label }))]
  }, [items])

  const heroItem = items[0]
  const gridItems = useMemo(() => items.slice(1, 7), [items])
  // Lowest-stock item gets the urgency banner slot
  const bottomDeal = useMemo(
    () => [...items].sort((a, b) => a.stockQuantity - b.stockQuantity)[0],
    [items]
  )

  const handleQuickAdd = (e: React.MouseEvent, item: ClearanceProduct) => {
    e.stopPropagation()
    addItem({
      id: item.id,
      productId: item.id,
      productName: item.name,
      productSlug: item.id,
      productImage: item.images?.[0]?.imageUrl || item.thumbnailUrl,
      variantId: null,
      variantName: null,
      variantValue: null,
      unitPrice: item.basePrice,
      totalPrice: item.basePrice * item.moq,
      quantity: item.moq,
      moq: item.moq,
      maxOrderQty: null,
      supplierId: item.supplier?.id || '',
      supplierName: item.supplier?.companyName || 'Zylod Supplier',
      supplierSlug: item.supplier?.id || '',
      unit: item.unit || 'unit',
      priceTiers: [],
    })
    toast.success(`Added ${item.name} to cart!`)
  }

  return (
    <div className="min-h-screen bg-[#FDF2F4] pb-24 md:pb-8">
      {/* ─── Top Header ─── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E0E0E0] h-14 flex items-center justify-between px-4 md:px-6">
        <button
          onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors md:hidden"
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

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4 md:px-6 md:pt-6 md:space-y-6 lg:max-w-5xl">
        {/* ─── Clearance Banner Card ─── */}
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-[#F5D0D6]">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-[#C8102E] uppercase">
            Clearance Sale
          </h1>
          <p className="text-xs text-[#4B5563] mt-2 max-w-[280px] mx-auto leading-relaxed">
            End-of-line wholesale inventory moving at clearance prices. Once it&apos;s gone, it&apos;s gone.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-[#C8102E] text-white text-xs font-black uppercase tracking-wider rounded-full shadow-sm">
            <Percent className="h-3.5 w-3.5" />
            {items.length > 0 ? `${items.length} lots clearing now` : 'Loading lots...'}
          </div>
        </div>

        {/* ─── Filter Tabs ─── */}
        {tabs.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.slug
              return (
                <button
                  key={tab.slug}
                  onClick={() => setActiveTab(tab.slug)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#C8102E] text-white shadow-sm'
                      : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        {/* ─── Loading / Error / Empty States ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280]">Loading clearance lots...</p>
          </div>
        )}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-14">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Percent className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-[#6B7280] max-w-[260px]">
              Nothing on clearance in this category right now.
            </p>
          </div>
        )}

        {/* ─── Featured Hero Card ─── */}
        {!isLoading && heroItem && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('product-detail', { productId: heroItem.id })}
            className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer md:flex"
          >
            <div className="relative aspect-[16/11] w-full bg-gray-100 md:w-1/2">
              { }
              <img
                src={heroItem.images?.[0]?.imageUrl || heroItem.thumbnailUrl || '/placeholder-product.svg'}
                alt={heroItem.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 bg-[#C8102E] text-white text-xs font-black px-2.5 py-0.5 rounded shadow">
                CLEARANCE
              </span>
            </div>

            <div className="p-4 md:w-1/2 md:p-6">
              <h3 className="font-bold text-sm text-[#1A1A1A] leading-snug">
                {heroItem.name}
              </h3>

              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-lg font-bold text-[#C8102E]">
                  {formatPrice(heroItem.basePrice)}
                </span>
                <span className="text-xs text-[#6B7280]">/ {heroItem.unit || 'unit'}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-[#6B7280] mt-3 pt-2 border-t border-gray-100">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-[#9CA3AF]">MOQ</span>
                  <span className="font-bold text-[#1A1A1A]">{heroItem.moq} {heroItem.unit || 'units'}</span>
                </div>

                <button
                  onClick={(e) => handleQuickAdd(e, heroItem)}
                  className="w-9 h-9 rounded-full bg-[#F3F4F6] hover:bg-[#FFE4E6] text-[#C8102E] flex items-center justify-center transition-colors shadow-sm"
                  title="Add to Cart"
                >
                  <ShoppingCart className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── 2-Column Grid ─── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {gridItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => navigate('product-detail', { productId: item.id })}
              className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-square w-full bg-gray-100">
                  { }
                  <img
                    src={item.images?.[0]?.imageUrl || item.thumbnailUrl || '/placeholder-product.svg'}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 bg-[#C8102E] text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow">
                    CLEARANCE
                  </span>
                </div>

                <div className="p-3">
                  <h4 className="font-bold text-xs text-[#1A1A1A] line-clamp-2 leading-tight">
                    {item.name}
                  </h4>
                  <div className="text-sm font-bold text-[#C8102E] mt-1.5">
                    {formatPrice(item.basePrice)}
                    <span className="text-[10px] font-normal text-[#6B7280]"> / {item.unit || 'unit'}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 pt-0 flex items-center justify-between text-[11px] text-[#6B7280]">
                <span>MOQ: {item.moq}</span>
                <button
                  onClick={(e) => handleQuickAdd(e, item)}
                  className="text-[#C8102E] hover:text-[#A50D24] p-1"
                  title="Add to Cart"
                >
                  <ShoppingCart className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ─── Bottom Banner Row Card (lowest stock) ─── */}
        {!isLoading && bottomDeal && gridItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('product-detail', { productId: bottomDeal.id })}
            className="bg-white rounded-2xl border border-[#E0E0E0] p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="relative w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0">
              { }
              <img
                src={bottomDeal.images?.[0]?.imageUrl || bottomDeal.thumbnailUrl || '/placeholder-product.svg'}
                alt={bottomDeal.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-1 left-1 bg-[#C8102E] text-white text-[9px] font-black px-1 py-0.2 rounded">
                LAST CALL
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-1">
                <h4 className="font-bold text-xs text-[#1A1A1A] truncate">{bottomDeal.name}</h4>
                <span className="font-bold text-xs text-[#C8102E] whitespace-nowrap">
                  {formatPrice(bottomDeal.basePrice)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#6B7280] mt-1">
                <div>
                  <span>MOQ: {bottomDeal.moq} {bottomDeal.unit || 'units'}</span>
                  <span className="block text-[#C8102E] font-bold mt-0.5">
                    Only {bottomDeal.stockQuantity} left
                  </span>
                </div>

                <button
                  onClick={(e) => handleQuickAdd(e, bottomDeal)}
                  className="px-3 py-1.5 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default ClearanceSalePage
