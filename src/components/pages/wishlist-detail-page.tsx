'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ShoppingCart, FolderPlus, Trash2, ChevronRight, TrendingDown } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

interface WishlistItemDetails {
  id: string
  note: string | null
  product: {
    id: string
    name: string
    basePrice: number
    moq: number
    images: { url: string }[]
    supplier: {
      id: string
      companyName: string
      isVerified: boolean
    }
  }
}

export function WishlistDetailPage() {
  const { pageParams, goBack, navigate } = useNavigationStore()
  const itemId = pageParams?.itemId

  const [item, setItem] = useState<WishlistItemDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    if (!itemId) {
      setLoading(false)
      return
    }
    const fetchItem = async () => {
      try {
        const res = await fetch(`/api/wishlist/${itemId}`)
        if (!res.ok) throw new Error('Failed to load')
        const json = await res.json()
        if (json.success) {
          setItem(json.data)
          setNote(json.data.note || '')
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchItem()
  }, [itemId])

  const handleSaveNote = async () => {
    setSavingNote(true)
    try {
      await fetch(`/api/wishlist/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      })
    } catch (err) {
      console.error(err)
    } finally {
      setSavingNote(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove from wishlist?')) return
    try {
      await fetch(`/api/wishlist/${itemId}`, { method: 'DELETE' })
      goBack()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white h-14 border-b flex items-center px-4">
          <Skeleton className="w-8 h-8 rounded-full" />
        </header>
        <Skeleton className="w-full aspect-square" />
        <div className="p-4 space-y-4">
          <Skeleton className="w-3/4 h-6" />
          <Skeleton className="w-1/2 h-4" />
          <Skeleton className="w-full h-32" />
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">Item not found.</p>
        <Button onClick={() => goBack()}>Go Back</Button>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="min-h-screen bg-gray-50 flex flex-col pb-24 md:pb-10"
    >
      <header className="bg-white h-14 flex items-center px-4 fixed top-0 w-full z-20 shadow-sm">
        <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 mr-2">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-semibold flex-1 truncate">Wishlist Item</h1>
      </header>

      <div className="mt-14 bg-white border-b">
        <div className="aspect-square bg-gray-100 relative">
          <img 
            src={item.product.images[0]?.url || '/placeholder.png'} 
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{item.product.name}</h2>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl font-bold text-primary">${item.product.basePrice.toFixed(2)}</span>
            <span className="text-sm text-gray-500">/ unit</span>
            <div className="ml-auto bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium flex items-center">
              <TrendingDown className="w-3 h-3 mr-1" /> -5% this week
            </div>
          </div>
          <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
            <span className="font-medium mr-2">Supplier:</span> 
            {item.product.supplier.companyName}
            {item.product.supplier.isVerified && (
              <span className="ml-2 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-bold">VERIFIED</span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Note Section */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold mb-2">Personal Note</h3>
          <Textarea 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add details like required size, color, or target price..."
            className="w-full text-sm resize-none mb-2 bg-gray-50 border-gray-200 h-24"
          />
          <div className="flex justify-end">
            <Button 
              size="sm" 
              variant="secondary"
              onClick={handleSaveNote}
              disabled={savingNote || note === (item.note || '')}
              className="rounded-full h-8 px-4 text-xs font-medium"
            >
              {savingNote ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" /> Add to Cart
          </Button>
          <Button 
            variant="outline"
            className="bg-white border-gray-200 text-gray-800 rounded-xl h-12 flex items-center justify-center gap-2"
          >
            <FolderPlus className="w-4 h-4" /> Move to Collection
          </Button>
        </div>

        <Button 
          variant="ghost"
          onClick={handleRemove}
          className="w-full text-red-500 hover:bg-red-50 hover:text-red-600 h-12 rounded-xl mt-2"
        >
          <Trash2 className="w-4 h-4 mr-2" /> Remove from Wishlist
        </Button>
      </div>
    </motion.div>
  )
}

export default WishlistDetailPage
