'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Share2, Heart, Search, MoreVertical, Trash2, ShoppingCart, Info, CheckSquare, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'

interface WishlistItem {
  id: string
  productId: string
  productName: string
  supplierName: string
  moq: number
  price: number
  oldPrice?: number
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  imageUrl: string
  rating: number
  dateAdded: string
}

export function WishlistPage() {
  const { navigate, goBack } = useNavigationStore()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [activeTab, setActiveTab] = useState<'ALL' | 'IN_STOCK' | 'PRICE_DROP'>('ALL')
  const [sortOption, setSortOption] = useState<'RECENT' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING'>('RECENT')
  
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/wishlist')
        if (!response.ok) throw new Error('Failed to fetch wishlist')
        const data = await response.json()
        setItems(data.items || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchWishlist()
  }, [])

  const handleRemove = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/wishlist/${itemId}`, { method: 'DELETE' })
      setItems(items.filter(item => item.id !== itemId))
    } catch (err) {
      console.error(err)
    }
  }

  const toggleSelect = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode)
    setSelectedItems(new Set())
  }

  const getFilteredAndSortedItems = () => {
    let result = [...items]
    if (activeTab === 'IN_STOCK') {
      result = result.filter(item => item.stockStatus === 'IN_STOCK')
    } else if (activeTab === 'PRICE_DROP') {
      result = result.filter(item => item.oldPrice && item.oldPrice > item.price)
    }

    result.sort((a, b) => {
      if (sortOption === 'RECENT') return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
      if (sortOption === 'PRICE_ASC') return a.price - b.price
      if (sortOption === 'PRICE_DESC') return b.price - a.price
      if (sortOption === 'RATING') return b.rating - a.rating
      return 0
    })

    return result
  }

  const displayedItems = getFilteredAndSortedItems()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 hidden md:block">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <h1 className="font-semibold text-lg md:text-xl">My Wishlist {!loading && `(${items.length})`}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => navigate('shared-wishlist')} className="p-2 rounded-full hover:bg-gray-100">
            <Share2 size={20} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-4 py-2 flex space-x-4 overflow-x-auto no-scrollbar">
        {['ALL', 'IN_STOCK', 'PRICE_DROP'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`whitespace-nowrap pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-gray-500'
            }`}
          >
            {tab === 'ALL' ? 'All Items' : tab === 'IN_STOCK' ? 'In Stock' : 'Price Drop'}
          </button>
        ))}
      </div>

      {/* Sort & Actions */}
      <div className="px-4 py-3 flex items-center justify-between">
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as any)}
          className="bg-transparent text-sm font-medium text-gray-700 outline-none"
        >
          <option value="RECENT">Recently Added</option>
          <option value="PRICE_ASC">Price Low-High</option>
          <option value="PRICE_DESC">Price High-Low</option>
          <option value="RATING">Rating</option>
        </select>

        <button 
          onClick={toggleBatchMode}
          className="text-sm font-medium text-primary"
        >
          {isBatchMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 md:px-6 md:py-6 pb-24 md:pb-10 lg:max-w-6xl lg:mx-auto lg:w-full">
        {loading ? (
          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white rounded-xl p-3 flex gap-4 shadow-sm animate-pulse">
                <div className="w-20 h-20 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4 mt-4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-10">{error}</div>
        ) : displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-red-50 text-primary rounded-full flex items-center justify-center mb-4">
              <Heart size={32} />
            </div>
            <h2 className="text-lg font-semibold mb-2">Your wishlist is empty</h2>
            <p className="text-gray-500 mb-6 max-w-[250px]">Save items you like here to review or buy them later.</p>
            <button
              onClick={() => navigate('home')}
              className="bg-primary text-white px-6 py-2.5 rounded-full font-medium"
            >
              Explore Products
            </button>
          </div>
        ) : (
          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
            <AnimatePresence>
              {displayedItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-xl shadow-sm overflow-hidden flex relative"
                  onClick={() => !isBatchMode && navigate('product-detail', { productId: item.productId })}
                >
                  {isBatchMode && (
                    <div 
                      className="pl-3 py-4 flex items-center justify-center"
                      onClick={(e) => toggleSelect(item.id, e)}
                    >
                      {selectedItems.has(item.id) ? (
                        <CheckSquare className="text-primary" size={20} />
                      ) : (
                        <Square className="text-gray-300" size={20} />
                      )}
                    </div>
                  )}

                  <div className={`p-3 flex gap-3 flex-1 ${isBatchMode ? 'pl-2' : ''}`}>
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="pr-8">
                        <h3 className="font-medium text-sm line-clamp-2">{item.productName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{item.supplierName}</p>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">MOQ: {item.moq}</span>
                          {item.stockStatus === 'IN_STOCK' ? (
                            <span className="text-[10px] text-green-600 font-medium">In Stock</span>
                          ) : item.stockStatus === 'LOW_STOCK' ? (
                            <span className="text-[10px] text-yellow-600 font-medium">Low Stock</span>
                          ) : (
                            <span className="text-[10px] text-red-600 font-medium">Out of Stock</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-end justify-between mt-2">
                        <div>
                          <p className="font-bold text-primary text-sm">${item.price.toFixed(2)}</p>
                          {item.oldPrice && item.oldPrice > item.price && (
                            <p className="text-[10px] text-gray-400 line-through">${item.oldPrice.toFixed(2)}</p>
                          )}
                        </div>
                        
                        {!isBatchMode && (
                          <button className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium">
                            Add to Cart
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isBatchMode && (
                    <button 
                      onClick={(e) => handleRemove(item.id, e)}
                      className="absolute top-3 right-3 p-1.5 bg-gray-50 rounded-full text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Batch Mode Footer */}
      {isBatchMode && displayedItems.length > 0 && (
        <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t p-4 flex gap-3 z-20">
          <button 
            disabled={selectedItems.size === 0}
            className="flex-1 py-3 border border-red-200 text-red-600 rounded-full font-medium disabled:opacity-50"
          >
            Remove ({selectedItems.size})
          </button>
          <button 
            disabled={selectedItems.size === 0}
            className="flex-1 py-3 bg-primary text-white rounded-full font-medium disabled:opacity-50"
          >
            Add to Cart
          </button>
        </div>
      )}
    </div>
  )
}

export default WishlistPage
