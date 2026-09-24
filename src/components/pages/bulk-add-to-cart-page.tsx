'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckSquare, Square, ShoppingCart, Info } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'

export function BulkAddToCartPage() {
  const { goBack, navigate } = useNavigationStore()
  const [items, setItems] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchWishlist()
  }, [])

  const fetchWishlist = async () => {
    try {
      // Real wishlist API — quantities default to each product's MOQ
      const res = await fetch('/api/wishlist')
      const json = await res.json()
      if (json.success && json.data) {
        setItems(json.data)
        const initialQs: Record<string, number> = {}
        json.data.forEach((item: any) => {
          initialQs[item.id] = item.product.moq || 1
        })
        setQuantities(initialQs)
      }
    } catch (error) {
      console.error('Failed to fetch wishlist', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(i => i.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  const updateQuantity = (id: string, newQuantity: number) => {
    const item = items.find(i => i.id === id)
    const min = item?.product.moq || 1
    if (newQuantity >= min) {
      setQuantities(prev => ({ ...prev, [id]: newQuantity }))
    }
  }

  const handleBulkAdd = async () => {
    if (selectedIds.size === 0) return
    setAdding(true)
    try {
      const selectedItems = Array.from(selectedIds).map(id => ({
        wishlistItemId: id,
        productId: items.find(i => i.id === id)?.product.id,
        quantity: quantities[id]
      }))
      
      const res = await fetch('/api/cart/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems })
      })
      
      if (res.ok) {
        setSuccess(true)
      }
    } catch (error) {
      console.error('Failed to add to cart', error)
    } finally {
      setAdding(false)
    }
  }

  const selectedTotal = Array.from(selectedIds).reduce((sum, id) => {
    const item = items.find(i => i.id === id)
    return sum + (item?.product.basePrice || 0) * (quantities[id] || 0)
  }, 0)

  if (success) {
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center p-6 md:p-10 text-center space-y-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2"
        >
          <ShoppingCart className="w-10 h-10" />
        </motion.div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Added to Cart!</h2>
          <p className="text-sm text-gray-500">Successfully added {selectedIds.size} items to your cart.</p>
        </div>
        <div className="w-full space-y-3 pt-4 md:max-w-xs md:mx-auto">
          <button 
            onClick={() => navigate('cart')}
            className="w-full py-3 bg-primary text-white font-medium rounded-lg active:bg-primary/90"
          >
            Go to Cart
          </button>
          <button 
            onClick={goBack}
            className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg active:bg-gray-200"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8">
      <header className="sticky top-0 z-50 bg-white border-b flex items-center px-4 h-14 md:hidden">
        <button onClick={goBack} className="p-2 -ml-2 mr-2 active:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900">Add to Cart</h1>
          <div className="text-xs text-gray-500">{selectedIds.size} selected</div>
        </div>
      </header>

      <main className="p-4 space-y-4 md:p-6 md:space-y-5 lg:max-w-6xl lg:mx-auto w-full">
        {/* Desktop page heading (mobile uses the sticky bar above) */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Add to Cart</h1>
          <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800">Select items and set quantities to add multiple products to your cart at once.</p>
        </div>

        <div className="flex items-center justify-between px-1">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-medium text-gray-700">
            {selectedIds.size === items.length && items.length > 0 ? (
              <CheckSquare className="w-5 h-5 text-primary" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
            Select All ({items.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white border rounded-xl p-3 shadow-sm flex gap-3 transition-colors ${selectedIds.has(item.id) ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200'}`}
              >
                <button onClick={() => toggleSelect(item.id)} className="mt-1 shrink-0">
                  {selectedIds.has(item.id) ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300" />
                  )}
                </button>
                
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  {item.product.thumbnailUrl ? (
                    <img src={item.product.thumbnailUrl} alt={item.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Image</div>
                  )}
                </div>
                
                <div className="flex-1 flex flex-col">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{item.product.name}</h3>
                  <div className="text-xs text-gray-500 mb-1">{item.product.supplier?.companyName}</div>
                  
                  <div className="font-medium text-gray-900 mb-2">
                    {item.product.currency} {item.product.basePrice} <span className="text-[10px] text-gray-500 font-normal">/{item.product.unit}</span>
                  </div>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center border rounded-lg bg-gray-50">
                      <button 
                        onClick={() => updateQuantity(item.id, (quantities[item.id] || 0) - 1)}
                        className="px-2.5 py-1 text-gray-600 active:bg-gray-200"
                        disabled={quantities[item.id] <= (item.product.moq || 1)}
                      >-</button>
                      <div className="px-2 text-sm font-medium min-w-[32px] text-center">{quantities[item.id]}</div>
                      <button 
                        onClick={() => updateQuantity(item.id, (quantities[item.id] || 0) + 1)}
                        className="px-2.5 py-1 text-gray-600 active:bg-gray-200"
                      >+</button>
                    </div>
                    {item.product.moq > 1 && (
                      <div className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        Min: {item.product.moq}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-40 md:bottom-0 md:px-6">
        <div className="md:max-w-6xl md:mx-auto">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-600">Total ({selectedIds.size} items)</span>
          <span className="text-lg font-bold text-gray-900">${selectedTotal.toFixed(2)}</span>
        </div>
        <button
          onClick={handleBulkAdd}
          disabled={selectedIds.size === 0 || adding}
          className="w-full py-3 bg-primary text-white font-medium rounded-lg disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 flex items-center justify-center gap-2"
        >
          {adding ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              Add {selectedIds.size} Items to Cart
            </>
          )}
        </button>
        </div>
      </div>
    </div>
  )
}

export default BulkAddToCartPage
