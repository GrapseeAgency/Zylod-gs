'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, TrendingDown, Search, CheckCircle2,
  Package, Tag, AlertCircle, Sparkles
} from 'lucide-react'

export function PriceAlertCreatePage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const initialProductId = pageParams?.productId || ''
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [targetPrice, setTargetPrice] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialProductId) {
      fetch(`/api/products/${initialProductId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setSelectedProduct(data.data)
            // suggest 10% discount target
            setTargetPrice(Math.round(data.data.basePrice * 0.9).toString())
          }
        })
        .catch(console.error)
    }
  }, [initialProductId])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      setSearching(true)
      const res = await fetch(`/api/products?search=${encodeURIComponent(searchQuery)}&limit=10`)
      const data = await res.json()
      if (data.success) {
        setSearchResults(data.data || [])
      }
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedProduct || !targetPrice) return
    const numericTarget = Number(targetPrice)
    if (isNaN(numericTarget) || numericTarget <= 0) {
      setError('Please enter a valid target price')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/price-alerts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: selectedProduct.id,
          targetPrice: numericTarget,
        }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setSuccess(true)
      } else {
        setError(data.error || 'Failed to create price alert')
      }
    } catch (err) {
      setError('Failed to create alert')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-bold text-gray-900 text-base">Create Price Drop Alert</span>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:max-w-2xl md:space-y-8 md:pb-10">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Create Price Drop Alert</h1>
        {success ? (
          <div className="bg-white rounded-3xl p-8 border border-green-100 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg md:text-2xl font-bold text-gray-900">Price Watch Activated!</h2>
            <p className="text-xs text-gray-600">
              We are actively monitoring <strong>{selectedProduct?.name}</strong>. As soon as the price hits <strong>{formatPrice(Number(targetPrice))}</strong> or lower, you will receive an instant push notification.
            </p>
            <div className="pt-3 flex gap-3 justify-center">
              <Button
                onClick={() => navigate('price-drop-alerts')}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                View Price Watches
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSuccess(false)
                  setSelectedProduct(null)
                  setTargetPrice('')
                }}
                className="text-xs font-bold"
              >
                Set Another
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Step 1: Product Selection */}
            {!selectedProduct ? (
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-gray-900">1. Select Product to Watch</h2>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search wholesale products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="text-xs"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={searching}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4"
                  >
                    Search
                  </Button>
                </div>

                {/* Search Results List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p)
                        setTargetPrice(Math.round(p.basePrice * 0.9).toString())
                      }}
                      className="p-3 bg-slate-50 hover:bg-red-50 rounded-2xl border border-gray-100 flex items-center justify-between cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {p.thumbnailUrl ? (
                            <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 line-clamp-1">{p.name}</p>
                          <p className="text-[11px] text-gray-500">Current: {formatPrice(p.basePrice)}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-red-600">Select →</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Selected Product Card */
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">Selected Product</h2>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Change Product
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-gray-100 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {selectedProduct.thumbnailUrl ? (
                      <img src={selectedProduct.thumbnailUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{selectedProduct.name}</p>
                    <p className="text-xs text-gray-500">
                      Current Price: <strong>{formatPrice(selectedProduct.basePrice)}</strong>
                    </p>
                  </div>
                </div>

                {/* Step 2: Target Price */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold text-gray-700 block">
                    Alert Me When Price Drops To (BDT ৳):
                  </label>
                  <Input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="Enter target price..."
                    className="text-sm font-bold text-red-600"
                  />

                  {/* Savings Calculation */}
                  {selectedProduct && targetPrice && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800 flex items-center justify-between">
                      <span>Potential Savings Per Unit:</span>
                      <strong className="font-bold">
                        {formatPrice(Math.max(0, selectedProduct.basePrice - Number(targetPrice)))}
                      </strong>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl">
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full md:w-auto md:px-10 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-md text-xs sm:text-sm"
                >
                  {submitting ? 'Setting Watch...' : 'Activate Price Drop Alert'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PriceAlertCreatePage
