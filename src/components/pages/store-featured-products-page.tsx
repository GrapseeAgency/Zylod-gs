'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Star, Plus, Trash2, GripVertical, Check, Eye,
  Sparkles, Layers, Search, Save, AlertCircle
} from 'lucide-react'

interface Product {
  id: string
  name: string
  slug: string
  basePrice: number
  moq: number
  unit: string
  thumbnailUrl: string | null
  stockQuantity: number
  isFeatured?: boolean
  sortOrder?: number
}

export function StoreFeaturedProductsPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [products, setProducts] = useState<Product[]>([])
  const [featuredIds, setFeaturedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'featured' | 'catalog'>('featured')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [prodRes, storeRes] = await Promise.all([
          fetch('/api/supplier/products'),
          fetch('/api/supplier/storefront')
        ])

        const prodData = await prodRes.json()
        const storeData = await storeRes.json()

        if (prodData.success && Array.isArray(prodData.data)) {
          setProducts(prodData.data)
        }

        if (storeData.success && storeData.data?.featuredProductIds) {
          try {
            const ids = typeof storeData.data.featuredProductIds === 'string'
              ? JSON.parse(storeData.data.featuredProductIds)
              : storeData.data.featuredProductIds
            setFeaturedIds(Array.isArray(ids) ? ids : [])
          } catch {
            setFeaturedIds([])
          }
        }
      } catch (err) {
        console.error('Failed to load featured products:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const toggleFeatured = (productId: string) => {
    setFeaturedIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    setFeaturedIds(prev => {
      const copy = [...prev]
      const temp = copy[index - 1]
      copy[index - 1] = copy[index]
      copy[index] = temp
      return copy
    })
  }

  const moveDown = (index: number) => {
    if (index === featuredIds.length - 1) return
    setFeaturedIds(prev => {
      const copy = [...prev]
      const temp = copy[index + 1]
      copy[index + 1] = copy[index]
      copy[index] = temp
      return copy
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/supplier/storefront', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featuredProductIds: JSON.stringify(featuredIds)
        })
      })
      if (res.ok) {
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Failed to save featured products:', err)
    } finally {
      setSaving(false)
    }
  }

  const featuredProductObjects = featuredIds
    .map(id => products.find(p => p.id === id))
    .filter((p): p is Product => Boolean(p))

  const catalogFiltered = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20 md:pb-8">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('store-customization')}
            className="md:hidden p-2 -ml-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              Featured Products Showcase
            </h1>
            <p className="text-xs text-neutral-400">Curate top-selling SKUs for your storefront banner</p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs sm:text-sm font-semibold h-9 px-4 flex items-center gap-1.5 shadow-lg shadow-red-950/40"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Publish
            </>
          )}
        </Button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Info Banner */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-neutral-300 space-y-1">
            <p className="font-semibold text-neutral-100">Boost Wholesale Inquiries</p>
            <p className="text-neutral-400">
              Featured products appear at the very top of your merchant storefront with an exclusive "Supplier Spotlight" badge. Select up to 8 high-demand wholesale SKUs.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b border-neutral-800 pb-2">
          <button
            onClick={() => setActiveTab('featured')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'featured'
                ? 'bg-[#C8102E]/20 text-[#C8102E] border border-[#C8102E]/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Star className="w-4 h-4" />
            Featured List ({featuredIds.length})
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'catalog'
                ? 'bg-[#C8102E]/20 text-[#C8102E] border border-[#C8102E]/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Select from Catalog ({products.length})
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(n => (
              <Skeleton key={n} className="h-20 w-full bg-neutral-900 rounded-xl" />
            ))}
          </div>
        ) : activeTab === 'featured' ? (
          /* Featured List Re-order Mode */
          <div className="space-y-3">
            {featuredProductObjects.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-neutral-800 rounded-2xl p-6 bg-neutral-900/30">
                <AlertCircle className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
                <h3 className="font-semibold text-neutral-300">No Featured Products Selected</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
                  Pin your top high-margin items to increase buyer conversions and fast-track RFQ leads.
                </p>
                <Button
                  onClick={() => setActiveTab('catalog')}
                  className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs px-4"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Browse Catalog & Pin SKUs
                </Button>
              </div>
            ) : (
              featuredProductObjects.map((product, idx) => (
                <motion.div
                  layout
                  key={product.id}
                  className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl p-3 shadow-md"
                >
                  <div className="flex flex-col items-center gap-1 text-neutral-500">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 hover:text-white disabled:opacity-30 text-xs"
                    >
                      ▲
                    </button>
                    <span className="text-[10px] font-mono font-bold text-neutral-400">#{idx + 1}</span>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === featuredProductObjects.length - 1}
                      className="p-1 hover:text-white disabled:opacity-30 text-xs"
                    >
                      ▼
                    </button>
                  </div>

                  <img
                    src={product.thumbnailUrl || '/placeholder.png'}
                    alt={product.name}
                    className="w-14 h-14 object-cover rounded-lg bg-neutral-800 border border-neutral-700 shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-neutral-200 truncate">{product.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-[#C8102E] font-bold">{formatPrice(product.basePrice)}</span>
                      <span className="text-neutral-400">MOQ: {product.moq} {product.unit}</span>
                      <Badge variant="outline" className="text-[10px] border-emerald-800/60 text-emerald-400 bg-emerald-950/20">
                        {product.stockQuantity} in stock
                      </Badge>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFeatured(product.id)}
                    className="text-neutral-400 hover:text-red-400 hover:bg-red-950/30 p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          /* Catalog Selection Mode */
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-500" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products by title, SKU, or category..."
                className="bg-neutral-900 border-neutral-800 pl-10 text-sm focus-visible:ring-[#C8102E]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catalogFiltered.map(product => {
                const isSelected = featuredIds.includes(product.id)
                return (
                  <Card
                    key={product.id}
                    onClick={() => toggleFeatured(product.id)}
                    className={`cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-[#C8102E]/10 border-[#C8102E] ring-1 ring-[#C8102E]/50'
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <img
                        src={product.thumbnailUrl || '/placeholder.png'}
                        alt={product.name}
                        className="w-14 h-14 object-cover rounded-lg bg-neutral-800 border border-neutral-700 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-neutral-200 truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="text-[#C8102E] font-bold">{formatPrice(product.basePrice)}</span>
                          <span className="text-neutral-400">MOQ: {product.moq}</span>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                        isSelected
                          ? 'bg-[#C8102E] border-[#C8102E] text-white'
                          : 'border-neutral-700 text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StoreFeaturedProductsPage
