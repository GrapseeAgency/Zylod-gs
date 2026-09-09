'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Filter, Star, Heart, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'

interface FavoriteItem {
  id: string
  productId: string
  productName: string
  supplierName: string
  isSupplierVerified: boolean
  moq: number
  price: number
  imageUrl: string
  rating: number
  category: string
  dateAdded: string
}

export function FavoritesPage() {
  const { navigate, goBack } = useNavigationStore()
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [activeFilter, setActiveFilter] = useState('All')
  const filters = ['All', 'Electronics', 'Industrial', 'Textiles', 'Food']
  
  const [sortOption, setSortOption] = useState<'RATING' | 'PRICE_ASC' | 'RECENT'>('RATING')

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/favorites')
        if (!response.ok) throw new Error('Failed to fetch favorites')
        const data = await response.json()
        setItems(data.items || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchFavorites()
  }, [])

  const handleRemove = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/favorites/${itemId}`, { method: 'DELETE' })
      setItems(items.filter(item => item.id !== itemId))
    } catch (err) {
      console.error(err)
    }
  }

  const getFilteredAndSortedItems = () => {
    let result = [...items]
    if (activeFilter !== 'All') {
      result = result.filter(item => item.category === activeFilter)
    }

    result.sort((a, b) => {
      if (sortOption === 'RATING') return b.rating - a.rating
      if (sortOption === 'PRICE_ASC') return a.price - b.price
      if (sortOption === 'RECENT') return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
      return 0
    })

    return result
  }

  const displayedItems = getFilteredAndSortedItems()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b px-4 pt-3 pb-2 flex items-center justify-between">
        <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 md:hidden">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <h1 className="font-semibold text-lg md:text-2xl">Favorites</h1>
          <p className="text-[10px] text-gray-500">Your highest-rated saved products</p>
        </div>
        <button className="p-2 -mr-2 rounded-full hover:bg-gray-100">
          <Filter size={20} />
        </button>
      </header>

      {/* Filter Chips */}
      <div className="bg-white border-b px-4 py-3 flex space-x-2 overflow-x-auto no-scrollbar">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeFilter === filter 
                ? 'bg-primary text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{displayedItems.length} Products</span>
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as any)}
          className="bg-transparent text-sm font-medium text-gray-700 outline-none"
        >
          <option value="RATING">Highest Rated</option>
          <option value="PRICE_ASC">Price: Low to High</option>
          <option value="RECENT">Recently Added</option>
        </select>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 pb-24 md:px-6 md:pb-8 md:max-w-6xl md:mx-auto w-full">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl p-3 shadow-sm animate-pulse">
                <div className="aspect-square bg-muted rounded-lg mb-3 skeleton-shimmer"></div>
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-6 bg-muted rounded-full w-full"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-10">{error}</div>
        ) : displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mb-4">
              <Star size={32} className="fill-current" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No favorites yet</h2>
            <p className="text-gray-500 mb-6 max-w-[250px]">Rate products highly in your wishlist to see them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence>
              {displayedItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-xl shadow-sm overflow-hidden relative flex flex-col"
                  onClick={() => navigate('product-detail', { productId: item.productId })}
                >
                  <div className="relative aspect-square bg-gray-100">
                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <Star size={10} className="fill-yellow-400 text-yellow-400" />
                      <span>{item.rating}</span>
                    </div>
                    <button 
                      onClick={(e) => handleRemove(item.id, e)}
                      className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-primary"
                    >
                      <Heart size={14} className="fill-current" />
                    </button>
                  </div>
                  
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-medium text-xs line-clamp-2 leading-tight mb-1">{item.productName}</h3>
                    
                    <div className="flex items-center gap-1 mb-2">
                      <p className="text-[10px] text-gray-500 truncate">{item.supplierName}</p>
                      {item.isSupplierVerified && (
                        <CheckCircle2 size={10} className="text-blue-500 shrink-0" />
                      )}
                    </div>

                    <div className="mt-auto">
                      <p className="font-bold text-primary text-sm">${item.price.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-500 mb-2">Min. Order: {item.moq}</p>
                      <button className="w-full bg-primary text-white py-1.5 rounded-full text-xs font-medium">
                        Order Now
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}

export default FavoritesPage
