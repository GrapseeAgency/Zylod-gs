'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Image as ImageIcon, ShoppingCart } from 'lucide-react'
import { useCurrencyStore } from '@/store/currency-store'

interface VisualProduct {
  id: string
  name: string
  basePrice: number
  thumbnailUrl?: string
  unit: string
  moq: number
  supplier: { companyName: string }
  similarityScore?: number
}

export function VisualSearchResultsPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const imageUrl = pageParams.imageUrl || ''
  const searchQuery = pageParams.query || ''
  const [products, setProducts] = useState<VisualProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (imageUrl || searchQuery) fetchResults()
    else setLoading(false)
  }, [imageUrl, searchQuery])

  async function fetchResults() {
    setLoading(true)
    try {
      const params = imageUrl
        ? `?url=${encodeURIComponent(imageUrl)}`
        : `?query=${encodeURIComponent(searchQuery)}`
      const res = await fetch(`/api/search/image${params}`)
      if (res.ok) {
        const json = await res.json()
        setProducts(json.data?.products || [])
      }
    } catch {}
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <span className="font-semibold text-gray-900 flex-1">Visual Search Results</span>
        </div>
        {imageUrl && (
          <div className="mt-2 flex items-center gap-2">
            <img src={imageUrl} alt="search" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
            <p className="text-xs text-gray-500">Products matching your image</p>
          </div>
        )}
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Visual Search Results</h1>

      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 p-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
            <ImageIcon className="w-12 h-12 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No matching products found</p>
            <p className="text-xs text-gray-400">Try uploading a clearer image or different angle</p>
            <button onClick={() => navigate('image-search')} className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl font-medium mt-2">Try Again</button>
          </div>
        ) : (
          <>
            <p className="px-4 pt-3 text-xs text-gray-400">{products.length} similar products found</p>
            <div className="grid grid-cols-2 gap-3 p-4">
              {products.map((p, idx) => (
                <motion.button key={p.id}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.04 }}
                  onClick={() => navigate('product-detail', { productId: p.id })}
                  className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-red-200 transition text-left shadow-sm">
                  <div className="aspect-square bg-gray-100 relative">
                    {p.thumbnailUrl && <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />}
                    {p.similarityScore && (
                      <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {Math.round(p.similarityScore * 100)}% match
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-gray-800 line-clamp-2">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{p.supplier.companyName}</p>
                    <p className="text-sm font-bold text-red-600 mt-1">{formatPrice(p.basePrice)}/{p.unit}</p>
                    <p className="text-xs text-gray-400">MOQ: {p.moq}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default VisualSearchResultsPage
