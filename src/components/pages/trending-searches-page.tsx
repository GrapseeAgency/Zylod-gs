'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, TrendingUp, Flame, Clock, Package } from 'lucide-react'
import { useCurrencyStore } from '@/store/currency-store'

interface TrendingProduct {
  id: string
  name: string
  basePrice: number
  thumbnailUrl?: string
  unit: string
  moq: number
  soldCount: number
  ratingAvg: number
  supplier: { companyName: string }
  category: { name: string }
}

interface TrendingCategory {
  id: string
  name: string
  slug: string
  iconUrl?: string
  _count: { products: number }
}

export function TrendingSearchesPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [products, setProducts] = useState<TrendingProduct[]>([])
  const [categories, setCategories] = useState<TrendingCategory[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [tab, setTab] = useState<'products' | 'categories'>('products')
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week')

  useEffect(() => { fetchTrending() }, [timeRange])

  async function fetchTrending() {
    setLoadingProducts(true)
    setLoadingCategories(true)
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/products?sortBy=soldCount&order=desc&limit=20&timeRange=${timeRange}`),
        fetch('/api/categories?includeCount=true&limit=10&isActive=true')
      ])
      if (pRes.ok) { const json = await pRes.json(); setProducts(json.data || json.products || []) }
      if (cRes.ok) { const json = await cRes.json(); setCategories(json.data || json.categories || []) }
    } catch {}
    setLoadingProducts(false)
    setLoadingCategories(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <span className="font-semibold text-gray-900 flex-1 flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500" />Trending</span>
        </div>
        {/* Time range */}
        <div className="flex gap-2 mb-3">
          {(['today', 'week', 'month'] as const).map(t => (
            <button key={t} onClick={() => setTimeRange(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${timeRange === t ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t === 'today' ? 'Today' : t === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
        {/* Tabs */}
        <div className="flex gap-2">
          {(['products', 'categories'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${tab === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10 md:px-6">
        {tab === 'products' ? (
          loadingProducts ? (
            <div className="px-4 pt-4 space-y-3 md:max-w-3xl md:mx-auto">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex gap-3"><Skeleton className="w-16 h-16 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div></div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <TrendingUp className="w-12 h-12 text-gray-200" />
              <p className="text-sm text-gray-500">No trending products yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {products.map((p, idx) => (
                <motion.button key={p.id}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                  onClick={() => navigate('product-detail', { productId: p.id })}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left">
                  <div className="flex-shrink-0 w-6 text-center">
                    <span className={`text-sm font-bold ${idx < 3 ? 'text-red-600' : 'text-gray-400'}`}>#{idx + 1}</span>
                  </div>
                  <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    {p.thumbnailUrl && <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.supplier.companyName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold text-red-600">{formatPrice(p.basePrice)}/{p.unit}</span>
                      <span className="text-xs text-gray-400">· {p.soldCount} sold</span>
                    </div>
                  </div>
                  {idx < 3 && <Flame className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                </motion.button>
              ))}
            </div>
          )
        ) : (
          loadingCategories ? (
            <div className="grid grid-cols-3 gap-3 p-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 p-4">
              {categories.map((cat, idx) => (
                <motion.button key={cat.id}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.04 }}
                  onClick={() => navigate('category-products', { category: cat.slug })}
                  className="flex flex-col items-center gap-2 p-3 bg-gray-50 hover:bg-red-50 rounded-xl transition group">
                  {cat.iconUrl ? (
                    <img src={cat.iconUrl} alt={cat.name} className="w-10 h-10 object-contain" />
                  ) : (
                    <Package className="w-8 h-8 text-gray-300 group-hover:text-red-300" />
                  )}
                  <span className="text-xs text-gray-700 group-hover:text-red-700 font-medium text-center line-clamp-2">{cat.name}</span>
                  <span className="text-xs text-gray-400">{cat._count.products} products</span>
                </motion.button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default TrendingSearchesPage
