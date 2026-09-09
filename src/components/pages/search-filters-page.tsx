'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Filter, SlidersHorizontal, X, ChevronDown, LayoutGrid, LayoutList } from 'lucide-react'
import { useCurrencyStore } from '@/store/currency-store'

interface FilterOption { label: string; value: string }
interface ActiveFilters { minPrice?: string; maxPrice?: string; category?: string; moq?: string; certifications?: string[] }
interface Product {
  id: string; name: string; basePrice: number; thumbnailUrl?: string
  unit: string; moq: number; supplier: { companyName: string }
  category: { name: string }; _count?: { reviews: number }; ratingAvg?: number
}

export function SearchFiltersPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<ActiveFilters>({
    category: pageParams.category || '',
    minPrice: pageParams.minPrice || '',
    maxPrice: pageParams.maxPrice || '',
    moq: pageParams.moq || '',
  })
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')

  const certOptions: FilterOption[] = [
    { label: 'ISO 9001:2015', value: 'iso9001' },
    { label: 'CE Certified', value: 'ce' },
    { label: 'RoHS Compliant', value: 'rohs' },
    { label: 'UL Listed', value: 'ul' },
    { label: 'FDA Approved', value: 'fda' },
  ]

  useEffect(() => { fetchProducts() }, [filters])

  async function fetchProducts() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.category) params.set('category', filters.category)
    if (filters.minPrice) params.set('minPrice', filters.minPrice)
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)
    if (filters.moq) params.set('maxMoq', filters.moq)
    params.set('limit', '20')
    try {
      const res = await fetch(`/api/products?${params}`)
      if (res.ok) {
        const json = await res.json()
        setProducts(json.data || json.products || [])
        setTotal(json.total || (json.data?.length ?? 0))
      }
    } catch {}
    setLoading(false)
  }

  function applyFilter(key: keyof ActiveFilters, value: string) {
    setFilters(f => ({ ...f, [key]: value }))
    setOpen(false)
  }

  function resetFilters() {
    setFilters({})
    setOpen(false)
  }

  const activeCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 md:px-6">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 pb-3">Filter &amp; Sort</h1>
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <span className="font-semibold text-gray-900 flex-1 md:text-lg">Filter & Sort</span>
          <button onClick={() => setLayout(l => l === 'grid' ? 'list' : 'grid')} className="p-1.5 rounded-full hover:bg-gray-100">
            {layout === 'grid' ? <LayoutList className="w-4 h-4 text-gray-600" /> : <LayoutGrid className="w-4 h-4 text-gray-600" />}
          </button>
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-red-50 text-sm font-medium text-gray-700 relative">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-xs rounded-full flex items-center justify-center">{activeCount}</span>}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">{loading ? 'Loading...' : `${total} products found`}</p>
      </div>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-gray-50">
          {filters.category && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
              {filters.category}<button onClick={() => applyFilter('category', '')}><X className="w-3 h-3 ml-1" /></button>
            </span>
          )}
          {filters.minPrice && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
              Min: {formatPrice(Number(filters.minPrice))}<button onClick={() => applyFilter('minPrice', '')}><X className="w-3 h-3 ml-1" /></button>
            </span>
          )}
          {filters.maxPrice && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
              Max: {formatPrice(Number(filters.maxPrice))}<button onClick={() => applyFilter('maxPrice', '')}><X className="w-3 h-3 ml-1" /></button>
            </span>
          )}
          <button onClick={resetFilters} className="px-2 py-1 text-xs text-gray-500 underline flex-shrink-0">Clear all</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10 md:px-6">
        <div className="md:max-w-4xl md:mx-auto">
        {loading ? (
          <div className={`p-4 ${layout === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}`}>
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className={layout === 'grid' ? 'h-52 rounded-xl' : 'h-24 rounded-xl'} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Filter className="w-12 h-12 text-gray-200" />
            <p className="text-sm text-gray-500">No products match your filters</p>
            <button onClick={resetFilters} className="text-sm text-red-600 font-medium">Clear filters</button>
          </div>
        ) : layout === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 p-4">
            {products.map((p, idx) => (
              <motion.button key={p.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                onClick={() => navigate('product-detail', { productId: p.id })}
                className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-red-200 transition text-left">
                <div className="aspect-square bg-gray-100">
                  {p.thumbnailUrl && <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-gray-800 line-clamp-2">{p.name}</p>
                  <p className="text-sm font-bold text-red-600 mt-1">{formatPrice(p.basePrice)}/{p.unit}</p>
                  <p className="text-xs text-gray-400">MOQ: {p.moq}</p>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
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
                  <p className="text-sm font-bold text-red-600 mt-1">{formatPrice(p.basePrice)}/{p.unit}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Filter sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="relative bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <span className="font-semibold text-gray-900">Filters</span>
              <div className="flex gap-3">
                <button onClick={resetFilters} className="text-sm text-gray-500">Reset</button>
                <button onClick={() => setOpen(false)} className="p-1"><X className="w-4 h-4 text-gray-600" /></button>
              </div>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Price Range (BDT)</p>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={filters.minPrice || ''} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <input type="number" placeholder="Max" value={filters.maxPrice || ''} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Max MOQ</p>
                <input type="number" placeholder="e.g. 100" value={filters.moq || ''} onChange={e => setFilters(f => ({ ...f, moq: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <button
                onClick={() => { fetchProducts(); setOpen(false) }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm"
              >
                Show Results
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default SearchFiltersPage
