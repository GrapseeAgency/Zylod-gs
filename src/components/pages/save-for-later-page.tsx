'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Trash2, ShoppingBag, Clock, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'

interface SavedItem {
  id: string
  productId: string
  productName: string
  supplierName: string
  moq: number
  price: number
  imageUrl: string
  dateSaved: string
  hasPriceChanged: boolean
}

export function SaveForLaterPage() {
  const { navigate, goBack } = useNavigationStore()
  const [items, setItems] = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [sortOption, setSortOption] = useState<'DATE' | 'PRICE_ASC' | 'NAME'>('DATE')
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchSavedItems = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/save-for-later')
      if (!response.ok) throw new Error('Failed to fetch saved items')
      const data = await response.json()
      setItems(data.items || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSavedItems()
  }, [])

  const handleRemove = async (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await fetch(`/api/save-for-later/${itemId}`, { method: 'DELETE' })
      setItems(prev => prev.filter(item => item.id !== itemId))
    } catch (err) {
      console.error(err)
    }
  }

  const handleMoveToCart = async (item: SavedItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      // Add to cart
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          quantity: item.moq
        })
      })
      // Remove from saved
      await handleRemove(item.id)
    } catch (err) {
      console.error(err)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all saved items?')) return
    setIsProcessing(true)
    for (const item of items) {
      await handleRemove(item.id)
    }
    setIsProcessing(false)
  }

  const handleMoveAllToCart = async () => {
    setIsProcessing(true)
    for (const item of items) {
      await handleMoveToCart(item)
    }
    setIsProcessing(false)
  }

  const getSortedItems = () => {
    let result = [...items]
    result.sort((a, b) => {
      if (sortOption === 'DATE') return new Date(b.dateSaved).getTime() - new Date(a.dateSaved).getTime()
      if (sortOption === 'PRICE_ASC') return a.price - b.price
      if (sortOption === 'NAME') return a.productName.localeCompare(b.productName)
      return 0
    })
    return result
  }

  const displayedItems = getSortedItems()

  // Helper to format date loosely
  const formatTimeAgo = (dateString: string) => {
    const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days} days ago`
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between md:px-6">
        <button onClick={() => goBack()} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <h1 className="font-semibold text-lg md:text-xl">Saved for Later</h1>
        </div>
        <button 
          onClick={handleClearAll}
          disabled={items.length === 0 || isProcessing}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 disabled:opacity-50 text-gray-500"
        >
          <Trash2 size={20} />
        </button>
      </header>

      {/* Info Banner */}
      <div className="bg-blue-50 px-4 py-2.5 flex items-center gap-2 text-blue-700 text-xs font-medium">
        <InfoIcon />
        <span>Items moved here from your cart</span>
      </div>

      {/* Sort */}
      <div className="px-4 py-3 flex items-center justify-end">
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as any)}
          className="bg-transparent text-sm font-medium text-gray-700 outline-none"
        >
          <option value="DATE">Date Saved</option>
          <option value="PRICE_ASC">Price</option>
          <option value="NAME">Name</option>
        </select>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 pb-[calc(var(--bottom-nav-h)+140px)] md:p-6 md:pb-8 md:max-w-5xl md:mx-auto md:w-full">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="h-10 bg-gray-200 rounded-full w-full"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-10">{error}</div>
        ) : displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag size={32} />
            </div>
            <h2 className="text-lg font-semibold mb-2">Nothing saved for later</h2>
            <p className="text-gray-500 mb-6 max-w-[250px]">Items you save from your cart will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {displayedItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="bg-white rounded-xl shadow-sm p-3 flex flex-col gap-3"
                  onClick={() => navigate('product-detail', { productId: item.productId })}
                >
                  {/* Top: Info */}
                  <div className="flex gap-3">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium text-sm line-clamp-2 leading-tight mb-1">{item.productName}</h3>
                      <p className="text-xs text-gray-500 mb-1">{item.supplierName}</p>
                      
                      <div className="flex items-end justify-between mt-2">
                        <div>
                          <p className="font-bold text-primary text-sm">${item.price.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-500">MOQ: {item.moq}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-gray-50 text-gray-500 px-2 py-1 rounded text-[10px] font-medium">
                      <Clock size={12} />
                      Saved {formatTimeAgo(item.dateSaved)}
                    </div>
                    {item.hasPriceChanged && (
                      <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-[10px] font-medium">
                        <AlertCircle size={12} />
                        Price may change
                      </div>
                    )}
                  </div>

                  {/* Bottom: Actions */}
                  <div className="flex items-center gap-2 mt-1">
                    <button 
                      onClick={(e) => handleRemove(item.id, e)}
                      disabled={isProcessing}
                      className="flex-1 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-full disabled:opacity-50"
                    >
                      Remove
                    </button>
                    <button 
                      onClick={(e) => handleMoveToCart(item, e)}
                      disabled={isProcessing}
                      className="flex-[2] py-2 text-sm font-medium bg-primary text-white rounded-full disabled:opacity-50"
                    >
                      Move to Cart
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Global Actions */}
      {displayedItems.length > 0 && (
        <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t p-4 flex gap-3 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <button 
            onClick={handleMoveAllToCart}
            disabled={isProcessing}
            className="w-full py-3 bg-primary text-white rounded-full font-medium disabled:opacity-50"
          >
            Move All to Cart
          </button>
        </div>
      )}
    </div>
  )
}

function InfoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  )
}

export default SaveForLaterPage
