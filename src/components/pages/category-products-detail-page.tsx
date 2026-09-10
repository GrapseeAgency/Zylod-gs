'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Tag, Package, ChevronRight, LayoutGrid, List, Search } from 'lucide-react'
import { useCurrencyStore } from '@/store/currency-store'

interface Product {
  id: string
  name: string
  basePrice: number
  thumbnailUrl?: string
  unit: string
  moq: number
  soldCount: number
  ratingAvg: number
  supplier: { companyName: string }
}

interface CategoryInfo {
  id: string
  name: string
  slug: string
  description?: string
  iconUrl?: string
  _count?: { products: number }
}

export function CategoryProductsDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const categorySlug = pageParams.category || ''
  const [products, setProducts] = useState<Product[]>([])
  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState('soldCount')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12

  useEffect(() => { fetchProducts() }, [categorySlug, sortBy, page])

  async function fetchProducts() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        category: categorySlug,
        sortBy,
        order: 'desc',
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      })
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/products?${params}`),
        fetch(`/api/categories/${categorySlug}`)
      ])
      if (pRes.ok) {
        const json = await pRes.json()
        setProducts(json.data || json.products || [])
        setTotal(json.total || 0)
      }
      if (cRes.ok) {
        const json = await cRes.json()
        setCategoryInfo(json.data || json)
      }
    } catch {}
    setLoading(false)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 md:px-6 pt-4 pb-2 max-w-6xl mx-auto">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 md:hidden"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 truncate md:text-lg">{categoryInfo?.name || categorySlug || 'Products'}</h1>
            {!loading && <p className="text-xs text-gray-400">{total} products</p>}
          </div>
          <button onClick={() => navigate('search-home')} className="p-1.5 rounded-full hover:bg-gray-100"><Search className="w-4 h-4 text-gray-600" /></button>
          <button onClick={() => setLayout(l => l === 'grid' ? 'list' : 'grid')} className="p-1.5 rounded-full hover:bg-gray-100">
            {layout === 'grid' ? <List className="w-4 h-4 text-gray-600" /> : <LayoutGrid className="w-4 h-4 text-gray-600" />}
          </button>
        </div>

        {/* Sort bar */}
        <div className="flex gap-2 px-4 md:px-6 pb-3 overflow-x-auto scrollbar-hide max-w-6xl mx-auto">
          {[
            { value: 'soldCount', label: 'Best Selling' },
            { value: 'basePrice', label: 'Price: Low' },
            { value: 'basePrice_desc', label: 'Price: High' },
            { value: 'ratingAvg', label: 'Top Rated' },
            { value: 'createdAt', label: 'Newest' },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => { setSortBy(value); setPage(1) }}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition ${sortBy === value ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-8">
        {loading ? (
          layout === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 md:px-6">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : (
            <div className="px-4 pt-4 space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          )
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Package className="w-12 h-12 text-gray-200" />
            <p className="text-sm text-gray-500">No products in this category yet</p>
          </div>
        ) : layout === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 md:px-6">
            {products.map((p, idx) => (
              <motion.button key={p.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                onClick={() => navigate('product-detail', { productId: p.id })}
                className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-red-200 transition text-left shadow-sm">
                <div className="aspect-square bg-gray-100">
                  {p.thumbnailUrl && <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{p.supplier.companyName}</p>
                  <p className="text-sm font-bold text-red-600 mt-1">{formatPrice(p.basePrice)}/{p.unit}</p>
                  <p className="text-xs text-gray-400">MOQ: {p.moq}</p>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-50 md:max-w-4xl md:mx-auto">
            {products.map((p, idx) => (
              <motion.button key={p.id}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                onClick={() => navigate('product-detail', { productId: p.id })}
                className="w-full flex gap-3 px-4 py-3 hover:bg-gray-50 transition text-left">
                <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                  {p.thumbnailUrl && <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 line-clamp-2">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.supplier.companyName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-red-600">{formatPrice(p.basePrice)}/{p.unit}</span>
                    {p.ratingAvg > 0 && <span className="text-xs text-gray-400">⭐{p.ratingAvg.toFixed(1)}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-2" />
              </motion.button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4 px-4">
            <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40">Previous</button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CategoryProductsDetailPage
