'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Tag, Layers, Search, ChevronRight } from 'lucide-react'

interface CategoryItem {
  id: string
  name: string
  slug: string
  _count: { products: number }
}

interface ProductItem {
  id: string
  name: string
  basePrice: number
  unit: string
  moq: number
  thumbnailUrl?: string
  supplier: { companyName: string }
}

export function SearchResultsCategoryPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const categorySlug = pageParams.category || ''
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [categorySlug])

  async function fetchData() {
    setLoading(true)
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch('/api/categories?includeCount=true&limit=20'),
        fetch(`/api/products?category=${categorySlug}&limit=12`)
      ])
      if (catRes.ok) {
        const json = await catRes.json()
        setCategories(json.data || json.categories || [])
      }
      if (prodRes.ok) {
        const json = await prodRes.json()
        setProducts(json.data || json.products || [])
      }
    } catch {}
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3 flex items-center gap-3 md:px-6">
        <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-gray-900 truncate capitalize">
            {categorySlug ? `${categorySlug.replace('-', ' ')} Results` : 'Browse by Category'}
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10 md:px-6">
        {/* Category Pills */}
        <div className="px-4 py-3 border-b border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate('search-results-category', { category: c.slug })}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                categorySlug === c.slug ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {c.name} ({c._count?.products || 0})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-800">No products in this category</p>
            <p className="text-xs text-gray-500 mt-1">Try choosing another category above</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {products.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => navigate('product-detail', { productId: p.id })}
                className="border border-gray-100 rounded-xl overflow-hidden cursor-pointer hover:border-red-200 transition"
              >
                <div className="aspect-square bg-gray-50">
                  {p.thumbnailUrl && (
                    <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-gray-800 line-clamp-2">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{p.supplier.companyName}</p>
                  <p className="text-sm font-bold text-red-600 mt-1">{formatPrice(p.basePrice)}/{p.unit}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchResultsCategoryPage
