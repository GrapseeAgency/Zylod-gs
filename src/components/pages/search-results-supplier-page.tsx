'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Search, Building2, Star, Package, ChevronRight } from 'lucide-react'

interface Supplier {
  id: string
  companyName: string
  businessType: string
  ratingAvg: number
  totalProducts: number
  totalOrders: number
  city?: string
  country?: string
  logoUrl?: string
  isVerified: boolean
}

export function SearchResultsSupplierPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const query = pageParams.query || ''
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState('ratingAvg')

  useEffect(() => { fetchSuppliers() }, [query, sortBy])

  async function fetchSuppliers() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: query, sortBy, limit: '20' })
      const res = await fetch(`/api/suppliers?${params}`)
      if (res.ok) {
        const json = await res.json()
        setSuppliers(json.data || [])
        setTotal(json.total || 0)
      }
    } catch {}
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 truncate md:text-xl">Suppliers{query ? `: "${query}"` : ''}</h1>
            {!loading && <p className="text-xs text-gray-400">{total} suppliers found</p>}
          </div>
          <button onClick={() => navigate('search-home')} className="p-1.5 rounded-full hover:bg-gray-100"><Search className="w-4 h-4 text-gray-600" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { value: 'ratingAvg', label: 'Top Rated' },
            { value: 'totalOrders', label: 'Most Orders' },
            { value: 'totalProducts', label: 'Most Products' },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => setSortBy(value)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition ${sortBy === value ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10 md:px-6">
        {loading ? (
          <div className="px-4 pt-4 space-y-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Building2 className="w-12 h-12 text-gray-200" />
            <p className="text-sm text-gray-500">No suppliers found{query ? ` for "${query}"` : ''}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {suppliers.map((s, idx) => (
              <motion.button key={s.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                onClick={() => navigate('seller-storefront', { supplierId: s.id })}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition text-left">
                {s.logoUrl ? (
                  <img src={s.logoUrl} alt={s.companyName} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.companyName}</p>
                    {s.isVerified && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex-shrink-0">✓ Verified</span>}
                  </div>
                  <p className="text-xs text-gray-500 capitalize">{s.businessType?.replace('_', ' ')}{s.city ? ` · ${s.city}` : ''}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500 flex items-center gap-0.5"><Star className="w-3 h-3 text-yellow-400" />{s.ratingAvg.toFixed(1)}</span>
                    <span className="text-xs text-gray-400"><Package className="w-3 h-3 inline mr-0.5" />{s.totalProducts} products</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchResultsSupplierPage
