'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Layers, Search, CheckCircle2,
  Package, Bell, AlertCircle
} from 'lucide-react'

export function StockAlertCreatePage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const initialProductId = pageParams?.productId || ''
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
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
    if (!selectedProduct) return

    try {
      setSubmitting(true)
      setError(null)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ productId: selectedProduct.id }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setSuccess(true)
      } else {
        setError(data.error || 'Failed to create restock alert')
      }
    } catch (err) {
      setError('Failed to create alert')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-bold text-gray-900 text-base">Back in Stock Notification</span>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Back in Stock Notification</h1>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24">
        {success ? (
          <div className="bg-white rounded-3xl p-8 border border-teal-100 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Restock Alert Enabled!</h2>
            <p className="text-xs text-gray-600">
              We will notify you immediately once <strong>{selectedProduct?.name}</strong> is back in stock at supplier factories.
            </p>
            <div className="pt-3 flex gap-3 justify-center">
              <Button
                onClick={() => navigate('back-in-stock-alerts')}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
              >
                View Stock Watches
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            {!selectedProduct ? (
              <>
                <h2 className="text-sm font-bold text-gray-900">Select Out of Stock Product</h2>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search product..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="text-xs"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={searching}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4"
                  >
                    Search
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className="p-3 bg-slate-50 hover:bg-teal-50 rounded-2xl border border-gray-100 flex items-center justify-between cursor-pointer transition"
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
                          <p className="text-[11px] text-gray-500">{formatPrice(p.basePrice)} • Stock: {p.stockQuantity}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-teal-600">Select →</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">Selected Product</h2>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs font-bold text-teal-600 hover:underline"
                  >
                    Change
                  </button>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-gray-100 flex items-center gap-3">
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
                      Wholesale Rate: {formatPrice(selectedProduct.basePrice)}
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl">
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-md text-xs sm:text-sm gap-2"
                >
                  <Bell className="w-4 h-4" />
                  {submitting ? 'Setting Alert...' : 'Notify Me When Restocked'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default StockAlertCreatePage
