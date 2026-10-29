'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Copy, Share2, Check, QrCode } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useWishlistStore } from '@/store/wishlist-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import { toast } from 'sonner'

export function SharedWishlistPage() {
  const { goBack, navigate, pageParams } = useNavigationStore()
  const toggleWishlist = useWishlistStore((s) => s.toggleItem)
  const isInWishlist = useWishlistStore((s) => s.isInWishlist)
  const { mode, shareToken } = pageParams || {}
  
  const [shareData, setShareData] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    const fetchShareData = async () => {
      try {
        if (mode === 'owner') {
          if (!isAuthenticated) return
          const res = await fetch('/api/wishlist/share')
          if (res.status === 401 || res.status === 403) {
            setSessionExpired(true)
            return
          }
          const json = await res.json()
          if (json.success) setShareData(json.data)
          else setLoadError('Could not load your wishlist sharing settings. Please try again later.')
        } else if (shareToken) {
          const res = await fetch(`/api/wishlist/shared?token=${shareToken}`)
          const json = await res.json()
          if (json.success) setShareData(json.data)
          else setLoadError('This shared wishlist link is invalid or has expired.')
        }
      } catch (error) {
        console.error('Failed to fetch share data', error)
        setLoadError('Something went wrong while loading this wishlist. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    fetchShareData()
  }, [mode, shareToken, isAuthenticated])

  const copyToClipboard = () => {
    if (shareData?.token) {
      navigator.clipboard.writeText(`${window.location.origin}/shared?token=${shareData.token}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 bg-gray-50 dark:bg-gray-950 flex items-center justify-center h-screen">
        <PageLoader className="min-h-0" />
      </div>
    )
  }

  if (mode === 'owner') {
    if (sessionExpired) return <AccountGate title="Session expired" message="Your session has expired. Sign in again to manage wishlist sharing." />
    if (!loading && !isAuthenticated) return <AccountGate title="Sign in to share your wishlist" message="Wishlist sharing is tied to your account. Sign in to continue." />
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
        <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-gray-900 border-b flex items-center px-4 h-14">
          <button onClick={goBack} className="p-2 -ml-2 mr-2 active:bg-gray-100 dark:bg-gray-900 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="font-semibold text-gray-900 dark:text-gray-100">Share Wishlist</h1>
        </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-neutral-100">Share Wishlist</h1>

        <main className="flex-1 p-4 space-y-6">
          {loadError && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm">{loadError}</div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-4 text-center"
          >
            <div className="w-48 h-48 mx-auto bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center mb-4">
              <QrCode className="w-16 h-16 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 rounded-lg p-2 mb-4 border">
              <div className="flex-1 truncate text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 font-mono">
                {shareData ? `${window.location.origin}/shared?token=${shareData.token}` : 'Generate link...'}
              </div>
              <button 
                onClick={copyToClipboard}
                className="p-2 bg-white dark:bg-gray-900 rounded shadow-sm border active:bg-gray-50 dark:bg-gray-950"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-500" />}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => {
                  const url = shareData?.token ? `${window.location.origin}/shared?token=${shareData.token}` : window.location.href
                  window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this wishlist: ${url}`)}`, '_blank', 'noopener,noreferrer')
                }}
                className="flex flex-col items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg"
                aria-label="Share via WhatsApp"
              >
                <Share2 className="w-5 h-5" />
                <span className="text-xs font-medium">WhatsApp</span>
              </button>
              <button
                onClick={() => {
                  const url = shareData?.token ? `${window.location.origin}/shared?token=${shareData.token}` : window.location.href
                  window.location.href = `mailto:?subject=${encodeURIComponent('Shared Zylod Wishlist')}&body=${encodeURIComponent(`Check out this wishlist: ${url}`)}`
                }}
                className="flex flex-col items-center gap-2 p-3 bg-primary/5 text-primary rounded-lg"
                aria-label="Share via Email"
              >
                <Share2 className="w-5 h-5" />
                <span className="text-xs font-medium">Email</span>
              </button>
              <button onClick={copyToClipboard} className="flex flex-col items-center gap-2 p-3 bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg" aria-label="Copy share link">
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
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-gray-900 border-b flex flex-col justify-center px-4 h-16">
        <div className="text-xs text-primary font-bold uppercase tracking-wider mb-1">ZYLOD MARKETPLACE</div>
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
          {shareData?.owner?.name ? `${shareData.owner.name}'s Wishlist` : 'Shared Wishlist'}
        </h1>
      </header>

      <main className="flex-1 p-4 pb-[calc(var(--bottom-nav-h)+140px)]">
        {loadError && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm mb-6">{loadError}</div>
        )}
        {shareData?.owner && (
          <div className="flex items-center gap-3 mb-6 bg-white dark:bg-gray-900 p-3 rounded-lg border shadow-sm">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {shareData.owner.name.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{shareData.owner.companyName || shareData.owner.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Shared with you</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {shareData?.items?.map((item: any) => (
            <motion.div
              key={item.product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border shadow-sm flex flex-col"
            >
              <div className="aspect-square bg-gray-100 dark:bg-gray-900 relative">
                {item.product.thumbnailUrl ? (
                  <img src={item.product.thumbnailUrl} alt={item.product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">No Image</div>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">{item.product.name}</h3>
                {shareData.settings?.showPrices && (
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {item.product.currency} {item.product.basePrice} <span className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">/{item.product.unit}</span>
                  </div>
                )}
                
                <div className="mt-auto space-y-2">
                  {shareData.settings?.allowAddToCart && (
                    <button
                      onClick={() => navigate('product-detail', { productId: item.product.id })}
                      className="w-full py-1.5 bg-primary text-white text-xs font-medium rounded active:bg-primary/90"
                      aria-label={`View ${item.product.name}`}
                    >
                      Add to Cart
                    </button>
                  )}
                  <button
                    onClick={() => {
                      toggleWishlist({
                        id: item.product.id,
                        name: item.product.name,
                        price: item.product.basePrice || 0,
                        originalPrice: item.product.basePrice || 0,
                        moq: item.product.moq || 1,
                        unit: item.product.unit || 'piece',
                        supplier: '',
                        location: '',
                        category: '',
                        customizable: false,
                      })
                      toast.success(isInWishlist(item.product.id) ? 'Removed from wishlist' : 'Saved to your wishlist')
                    }}
                    className="w-full py-1.5 bg-white dark:bg-gray-900 border border-gray-300 text-gray-700 dark:text-gray-300 text-xs font-medium rounded active:bg-gray-50 dark:bg-gray-950"
                    aria-label={`Save ${item.product.name} to your wishlist`}
                  >
                    Save to My Wishlist
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t z-50 md:static md:bottom-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <button
          onClick={() => navigate('home')}
          className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg active:bg-primary/80"
          aria-label="Shop on Zylod homepage"
        >
          Shop on Zylod
        </button>
      </div>
    </div>
  )
}

export default SharedWishlistPage
import { PageLoader } from '@/components/ui/page-loader'
