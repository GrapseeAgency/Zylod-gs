'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Copy, Share2, Check, QrCode } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'

export function SharedWishlistPage() {
  const { goBack, pageParams } = useNavigationStore()
  const { mode, shareToken } = pageParams || {}
  
  const [shareData, setShareData] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchShareData = async () => {
      try {
        if (mode === 'owner') {
          const res = await fetch('/api/wishlist/share')
          const json = await res.json()
          if (json.success) setShareData(json.data)
        } else if (shareToken) {
          const res = await fetch(`/api/wishlist/shared?token=${shareToken}`)
          const json = await res.json()
          if (json.success) setShareData(json.data)
        }
      } catch (error) {
        console.error('Failed to fetch share data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchShareData()
  }, [mode, shareToken])

  const copyToClipboard = () => {
    if (shareData?.token) {
      navigator.clipboard.writeText(`${window.location.origin}/shared?token=${shareData.token}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (mode === 'owner') {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="md:hidden sticky top-0 z-50 bg-white border-b flex items-center px-4 h-14">
          <button onClick={goBack} className="p-2 -ml-2 mr-2 active:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-semibold text-gray-900">Share Wishlist</h1>
        </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Share Wishlist</h1>

        <main className="flex-1 p-4 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border p-4 text-center"
          >
            <div className="w-48 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4">
              <QrCode className="w-16 h-16 text-gray-400" />
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 mb-4 border">
              <div className="flex-1 truncate text-sm text-gray-600 font-mono">
                {shareData ? `${window.location.origin}/shared?token=${shareData.token}` : 'Generate link...'}
              </div>
              <button 
                onClick={copyToClipboard}
                className="p-2 bg-white rounded shadow-sm border active:bg-gray-50"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button className="flex flex-col items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                <Share2 className="w-5 h-5" />
                <span className="text-xs font-medium">WhatsApp</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg">
                <Share2 className="w-5 h-5" />
                <span className="text-xs font-medium">Email</span>
              </button>
              <button onClick={copyToClipboard} className="flex flex-col items-center gap-2 p-3 bg-gray-100 text-gray-700 rounded-lg">
                <Copy className="w-5 h-5" />
                <span className="text-xs font-medium">Copy Link</span>
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b flex flex-col justify-center px-4 h-16">
        <div className="text-xs text-primary font-bold uppercase tracking-wider mb-1">ZYLOD MARKETPLACE</div>
        <h1 className="font-semibold text-gray-900 truncate">
          {shareData?.owner?.name ? `${shareData.owner.name}'s Wishlist` : 'Shared Wishlist'}
        </h1>
      </header>

      <main className="flex-1 p-4 pb-[calc(var(--bottom-nav-h)+140px)]">
        {shareData?.owner && (
          <div className="flex items-center gap-3 mb-6 bg-white p-3 rounded-lg border shadow-sm">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {shareData.owner.name.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">{shareData.owner.companyName || shareData.owner.name}</div>
              <div className="text-xs text-gray-500">Shared with you</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {shareData?.items?.map((item: any) => (
            <motion.div
              key={item.product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg overflow-hidden border shadow-sm flex flex-col"
            >
              <div className="aspect-square bg-gray-100 relative">
                {item.product.thumbnailUrl ? (
                  <img src={item.product.thumbnailUrl} alt={item.product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">No Image</div>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-xs font-medium text-gray-900 line-clamp-2 mb-1">{item.product.name}</h3>
                {shareData.settings?.showPrices && (
                  <div className="text-sm font-bold text-gray-900 mb-2">
                    {item.product.currency} {item.product.basePrice} <span className="text-[10px] text-gray-500 font-normal">/{item.product.unit}</span>
                  </div>
                )}
                
                <div className="mt-auto space-y-2">
                  {shareData.settings?.allowAddToCart && (
                    <button className="w-full py-1.5 bg-primary text-white text-xs font-medium rounded active:bg-primary/90">
                      Add to Cart
                    </button>
                  )}
                  <button className="w-full py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded active:bg-gray-50">
                    Save to My Wishlist
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 p-4 bg-white border-t z-50">
        <button className="w-full py-3 bg-gray-900 text-white font-medium rounded-lg active:bg-gray-800">
          Shop on Zylod
        </button>
      </div>
    </div>
  )
}

export default SharedWishlistPage
