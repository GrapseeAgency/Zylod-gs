'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft,
  HelpCircle,
  Search,
  Star,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Building2,
  ChevronRight,
} from 'lucide-react'

interface SupplierRow {
  id: string
  companyName: string
  ratingAvg: number | null
  ratingCount?: number
  verificationStatus: string
  productCount?: number
}

export function SuppliersDirectoryPage() {
  const { navigate, goBack } = useNavigationStore()
  const [search, setSearch] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const qs = q.trim() ? `&search=${encodeURIComponent(q.trim())}` : ''
      const res = await fetch(`/api/suppliers?verificationStatus=approved&sort=rating&limit=30${qs}`)
      const json = await res.json()
      if (res.ok && json.success) {
        setSuppliers(json.data)
      } else {
        setLoadError('Supplier directory is unavailable right now.')
      }
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load('')
  }, [load])

  // Debounced search
  useEffect(() => {
    if (!search.trim()) return
    const t = setTimeout(() => load(search), 400)
    return () => clearTimeout(t)
  }, [search, load])

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-[calc(64px+env(safe-area-inset-bottom)+24px)]">
      {/* ─── Top Nav Bar ─── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E0E0E0] h-14 flex items-center justify-between px-4">
        <button
          onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-[#C8102E]" />
        </button>
        <span className="text-lg font-bold text-[#C8102E]">Zylod</span>
        <button
          onClick={() => navigate('help-center')}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5 text-[#6B7280]" />
        </button>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        <div className="text-center">
          <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight">Verified Suppliers</h1>
          <p className="text-xs text-[#6B7280] mt-1">Trade-assured manufacturers ready for bulk orders.</p>
        </div>

        {/* ─── Search ─── */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-white border border-[#E0E0E0] rounded-xl text-sm text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] shadow-sm"
          />
        </div>

        {/* ─── Loading / Error / Empty States ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280]">Loading suppliers...</p>
          </div>
        )}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-14">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && suppliers.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Building2 className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-[#6B7280] max-w-[260px]">
              No verified suppliers match &ldquo;{search}&rdquo;.
            </p>
          </div>
        )}

        {/* ─── Supplier Cards ─── */}
        <div className="space-y-3">
          {suppliers.map((sup, idx) => (
            <motion.div
              key={sup.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              onClick={() => navigate('seller-storefront', { supplierId: sup.id })}
              className="bg-white rounded-2xl border border-[#E0E0E0] p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFE4E6] to-[#FECDD3] flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-[#C8102E]">
                  {sup.companyName.slice(0, 2).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-[#1A1A1A] truncate">{sup.companyName}</h3>
                  {sup.verificationStatus === 'approved' && (
                    <ShieldCheck className="h-3.5 w-3.5 text-[#059669] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#6B7280]">
                  {sup.ratingAvg !== null && sup.ratingAvg > 0 ? (
                    <span className="flex items-center gap-1 font-semibold text-[#C8102E]">
                      <Star className="h-3 w-3 fill-[#C8102E]" />
                      {sup.ratingAvg.toFixed(1)}
                    </span>
                  ) : (
                    <span>New supplier</span>
                  )}
                  {typeof sup.productCount === 'number' && sup.productCount > 0 && (
                    <span>{sup.productCount} products</span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SuppliersDirectoryPage
