'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Heart, Share2, Info, ArrowRight } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface SharedProduct {
  id: string
  name: string
  image: string
  price: number
  inStock: boolean
  moq: number
}

interface SharedWishlist {
  id: string
  name: string
  ownerName: string
  ownerAvatar?: string
  totalItems: number
  totalValue: number
  items: SharedProduct[]
  allowAddToCart: boolean
  allowPrices: boolean
}

export function SharedWishlistDetailPage() {
  const { pageParams, navigate } = useNavigationStore()
  const token = pageParams?.token || pageParams?.shareToken
  
  const [data, setData] = useState<SharedWishlist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invalid share link.')
      setLoading(false)
      return
    }

    const fetchSharedWishlist = async () => {
      try {
        const res = await fetch(`/api/wishlist/shared?token=${token}`)
        if (!res.ok) throw new Error('Failed to load shared wishlist')
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        } else {
          throw new Error(json.error || 'Wishlist not found')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSharedWishlist()
  }, [token])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 pb-20 md:pb-8">
        <div className="p-4 bg-white border-b flex justify-center items-center h-14">
          <Skeleton className="w-24 h-6 bg-red-100 rounded" />
        </div>
        <div className="p-4">
          <Skeleton className="w-full h-24 rounded-xl mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="w-full h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Info className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Wishlist Unavailable</h2>
        <p className="text-gray-500 mb-6">{error || 'This link may be expired or invalid.'}</p>
        <Button onClick={() => navigate('home')} className="bg-primary text-white w-full rounded-full">
          Go to Zylod Homepage
        </Button>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col min-h-screen bg-gray-50 pb-24"
    >
      {/* Header */}
      <header className="bg-white border-b h-14 flex items-center justify-center sticky top-0 z-10">
        <h1 className="text-xl font-black text-primary tracking-tight">ZYLOD</h1>
      </header>

      {/* Owner Banner */}
      <div className="bg-white p-6 border-b text-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center overflow-hidden">
          {data.ownerAvatar ? (
            <img src={data.ownerAvatar} alt={data.ownerName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-gray-500">{data.ownerName.charAt(0)}</span>
          )}
        </div>
        <h2 className="text-lg font-bold text-gray-900">{data.ownerName}'s Wishlist</h2>
        <p className="text-sm text-gray-500 mt-1">
          {data.totalItems} items {data.allowPrices && `• Total value: $${data.totalValue.toFixed(2)}`}
        </p>
      </div>

      {/* Products Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {data.items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl overflow-hidden border flex flex-col relative group">
              {!item.inStock && (
                <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
                  <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span>
                </div>
              )}
              
              <div className="aspect-square bg-gray-100 relative">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                <button className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full text-gray-400 hover:text-primary z-20">
                  <Heart className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{item.name}</h3>
                
                {data.allowPrices && (
                  <p className="text-primary font-bold text-sm mb-2">${item.price.toFixed(2)}</p>
                )}

                <div className="mt-auto">
                  {data.allowAddToCart && item.inStock ? (
                    <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-white rounded-full h-8 text-xs">
                      <ShoppingCart className="w-3 h-3 mr-1" /> Add
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full rounded-full h-8 text-xs text-gray-600">
                      View Details
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-600">Share this list</span>
          <button className="text-primary flex items-center text-sm font-semibold">
            <Share2 className="w-4 h-4 mr-1" /> Share
          </button>
        </div>
        <Button onClick={() => navigate('home')} className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-xl h-12 text-base font-semibold">
          Shop these products on Zylod <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  )
}

export default SharedWishlistDetailPage
