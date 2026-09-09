'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Hash, ChevronRight, Package, Grid3X3 } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  iconUrl?: string
  sortOrder: number
  children?: SubCategory[]
  _count?: { products: number }
}

interface SubCategory {
  id: string
  name: string
  slug: string
  _count?: { products: number }
}

export function CategoryTreePage() {
  const { navigate, goBack } = useNavigationStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Category | null>(null)

  useEffect(() => { fetchTree() }, [])

  async function fetchTree() {
    setLoading(true)
    try {
      const res = await fetch('/api/categories/tree')
      if (res.ok) {
        const json = await res.json()
        setCategories(json.data || [])
      }
    } catch {}
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 flex items-center gap-3 px-4 md:px-6 py-3">
        <button onClick={selected ? () => setSelected(null) : goBack} className={`p-1.5 rounded-full hover:bg-gray-100 ${selected ? '' : 'md:hidden'}`}>
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 max-w-5xl mx-auto">
          <h1 className="font-semibold text-gray-900 md:text-lg">{selected ? selected.name : 'Category Tree'}</h1>
          {selected && <p className="text-xs text-gray-400 flex items-center gap-1"><Grid3X3 className="w-3 h-3" />All Categories → {selected.name}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-8">
        {loading ? (
          <div className="px-4 md:px-6 pt-4 space-y-2 max-w-5xl mx-auto">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : !selected ? (
          /* Top-level categories */
          <div className="divide-y divide-gray-50 md:max-w-4xl md:mx-auto">
            {categories.map((cat, idx) => (
              <motion.button key={cat.id}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                onClick={() => cat.children?.length ? setSelected(cat) : navigate('category-products', { category: cat.slug })}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition text-left group">
                {cat.iconUrl ? (
                  <img src={cat.iconUrl} alt={cat.name} className="w-10 h-10 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Hash className="w-5 h-5 text-red-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-red-600">{cat.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cat._count && <p className="text-xs text-gray-400">{cat._count.products} products</p>}
                    {cat.children?.length && <p className="text-xs text-gray-400">· {cat.children.length} sub-categories</p>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        ) : (
          /* Sub-categories of selected */
          <div className="md:max-w-4xl md:mx-auto">
            {/* "See all" in parent */}
            <button
              onClick={() => navigate('category-products', { category: selected.slug })}
              className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 border-b border-red-100 text-left">
              <Package className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm font-medium text-red-700">All {selected.name} Products</span>
              {selected._count && <span className="text-xs text-red-400 ml-auto">{selected._count.products} products</span>}
            </button>
            <div className="divide-y divide-gray-50">
              {(selected.children || []).map((sub, idx) => (
                <motion.button key={sub.id}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                  onClick={() => navigate('category-products', { category: sub.slug })}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left group">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Hash className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 group-hover:text-red-600">{sub.name}</p>
                    {sub._count && <p className="text-xs text-gray-400">{sub._count.products} products</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CategoryTreePage
