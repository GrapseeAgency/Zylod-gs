'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Search, ChevronRight, Grid3X3, List, Hash } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  iconUrl?: string
  sortOrder: number
  isActive: boolean
  _count?: { products: number }
  children?: SubCategory[]
}

interface SubCategory {
  id: string
  name: string
  slug: string
  _count?: { products: number }
}

type LayoutMode = 'grid' | 'list'

export function CategoryNavigationPage() {
  const { navigate, goBack } = useNavigationStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useState<LayoutMode>('grid')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchCategories() }, [])

  async function fetchCategories() {
    setLoading(true)
    try {
      const res = await fetch('/api/categories?includeCount=true&limit=100&isActive=true')
      if (res.ok) {
        const json = await res.json()
        setCategories(json.data || json.categories || [])
      }
    } catch {}
    setLoading(false)
  }

  const filtered = query.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : categories

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 md:px-6 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3 max-w-5xl mx-auto">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 md:hidden"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <span className="font-semibold text-gray-900 flex-1 md:text-lg">All Categories</span>
          <button onClick={() => setLayout(l => l === 'grid' ? 'list' : 'grid')} className="p-1.5 rounded-full hover:bg-gray-100">
            {layout === 'grid' ? <List className="w-4 h-4 text-gray-600" /> : <Grid3X3 className="w-4 h-4 text-gray-600" />}
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 max-w-5xl mx-auto">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search categories..."
            className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder:text-gray-400"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-8">
        {loading ? (
          layout === 'grid' ? (
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 p-4 md:px-6">
              {[1,2,3,4,5,6,7,8,9].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="px-4 pt-4 space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Hash className="w-12 h-12 text-gray-200" />
            <p className="text-sm text-gray-500">No categories found for &ldquo;{query}&rdquo;</p>
          </div>
        ) : layout === 'grid' ? (
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 p-4 md:px-6">
            {filtered.map((cat, idx) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => navigate('category-products', { category: cat.slug })}
                className="flex flex-col items-center gap-2 p-3 bg-gray-50 hover:bg-red-50 rounded-xl transition group"
              >
                {cat.iconUrl ? (
                  <img src={cat.iconUrl} alt={cat.name} className="w-10 h-10 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center">
                    <Hash className="w-8 h-8 text-gray-300 group-hover:text-red-300" />
                  </div>
                )}
                <span className="text-xs text-gray-700 group-hover:text-red-700 text-center leading-tight line-clamp-2 font-medium">{cat.name}</span>
                {cat._count && (
                  <span className="text-xs text-gray-400">{cat._count.products} products</span>
                )}
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-50 md:max-w-4xl md:mx-auto">
            {filtered.map((cat, idx) => (
              <motion.div key={cat.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition group"
                  onClick={() => {
                    if (cat.children?.length) {
                      setExpandedId(expandedId === cat.id ? null : cat.id)
                    } else {
                      navigate('category-products', { category: cat.slug })
                    }
                  }}
                >
                  {cat.iconUrl ? (
                    <img src={cat.iconUrl} alt={cat.name} className="w-8 h-8 object-contain flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Hash className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-red-600">{cat.name}</p>
                    {cat._count && <p className="text-xs text-gray-400">{cat._count.products} products</p>}
                  </div>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition ${expandedId === cat.id ? 'rotate-90' : ''}`} />
                </button>

                {/* Sub-categories */}
                <AnimatePresence>
                  {expandedId === cat.id && cat.children && cat.children.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-gray-50"
                    >
                      {cat.children.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => navigate('category-products', { category: sub.slug })}
                          className="w-full flex items-center gap-3 pl-12 pr-4 py-2.5 hover:bg-gray-100 transition"
                        >
                          <span className="text-sm text-gray-600">{sub.name}</span>
                          {sub._count && <span className="text-xs text-gray-400 ml-auto">{sub._count.products}</span>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CategoryNavigationPage
