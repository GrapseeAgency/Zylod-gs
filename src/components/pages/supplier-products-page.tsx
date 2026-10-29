'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageLoader } from '@/components/ui/page-loader'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  QrCode, Bell, Mail, Star, Store,
  CheckCircle2, Package, MapPin, AlertCircle, RefreshCw, ChevronDown
} from 'lucide-react'

interface SupplierProfile {
  id: string
  companyName: string
  verificationStatus: string
  ratingAvg: number
  ratingCount: number
  productCount: number
  warehouseCity: string
  warehouseDistrict: string
}

interface SupplierProduct {
  id: string
  name: string
  basePrice: number
  moq: number
  unit: string
  soldCount: number
  image: string | null
  categoryName: string
}

export function SupplierProductsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const supplierId = pageParams.supplierId || pageParams.id || ''

  const [profile, setProfile] = useState<SupplierProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [products, setProducts] = useState<SupplierProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  const PAGE_SIZE = 12

  const mapProduct = (p: Record<string, unknown>): SupplierProduct => {
    const images = p.images as Array<{ imageUrl?: string }> | undefined
    const category = p.category as { name?: string } | undefined
    return {
      id: String(p.id ?? ''),
      name: String(p.name ?? ''),
      basePrice: typeof p.basePrice === 'number' ? p.basePrice : 0,
      moq: typeof p.moq === 'number' ? p.moq : 1,
      unit: String(p.unit ?? 'pcs'),
      soldCount: typeof p.soldCount === 'number' ? p.soldCount : 0,
      image: images?.[0]?.imageUrl || (p.thumbnailUrl as string | null) || null,
      categoryName: category?.name || '',
    }
  }

  const fetchProfile = useCallback(async () => {
    if (!supplierId) return
    setProfileError(null)
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setProfileError(data?.error || `Failed to load supplier (${res.status})`)
        setProfile(null)
        return
      }
      setProfile(data?.data || null)
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Network error while loading supplier')
    }
  }, [supplierId])

  const fetchProducts = useCallback(async (pageNum: number, append: boolean) => {
    if (!supplierId) return
    if (append) setLoadingMore(true)
    else {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(`/api/products?supplierId=${encodeURIComponent(supplierId)}&limit=${PAGE_SIZE}&page=${pageNum}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || `Failed to load supplier products (${res.status})`)
        if (!append) setProducts([])
        return
      }
      const items = Array.isArray(data?.data) ? data.data : []
      const mapped = items.map(mapProduct)
      setProducts((prev) => (append ? [...prev, ...mapped] : mapped))
      setTotal(typeof data?.pagination?.total === 'number' ? data.pagination.total : mapped.length)
      setTotalPages(typeof data?.pagination?.totalPages === 'number' ? data.pagination.totalPages : 1)
      setPage(pageNum)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while loading supplier products')
      if (!append) setProducts([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [supplierId])

  useEffect(() => {
    if (!supplierId) {
      setLoading(false)
      return
    }
    fetchProfile()
    fetchProducts(1, false)
  }, [supplierId, fetchProfile, fetchProducts])

  /* Category filter derived from the supplier's real product categories */
  const availableCategories = useMemo(() => {
    const names = new Set<string>()
    for (const p of products) if (p.categoryName) names.add(p.categoryName)
    return Array.from(names)
  }, [products])

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products
    return products.filter((p) => p.categoryName === activeCategory)
  }, [products, activeCategory])

  const initials = useMemo(() => {
    if (!profile?.companyName) return ''
    return profile.companyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('')
  }, [profile])

  /* ─── No supplier selected — honest state ─── */
  if (!supplierId) {
    return (
      <div className="min-h-screen bg-background pb-24 md:pb-10 text-slate-900 dark:text-neutral-100">
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-neutral-800 flex items-center justify-center mb-4">
            <Store className="h-9 w-9 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
          </div>
          <h1 className="text-base font-black text-slate-900 dark:text-neutral-100">No supplier selected</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-2 max-w-xs mx-auto leading-relaxed">
            Open a supplier profile to browse their live product listings.
          </p>
          <Button
            onClick={() => navigate('explore')}
            className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-md"
          >
            Explore Suppliers
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-10 text-slate-900 dark:text-neutral-100">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700 dark:text-neutral-300" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button onClick={() => navigate("notifications")} className="p-1 text-slate-700 dark:text-neutral-300" title="Notifications" aria-label="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-neutral-100 px-6 pt-6">Supplier Products</h1>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-4xl md:px-6">
        {/* Supplier Profile Card — real data or real error */}
        {profileError ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-rose-200 shadow-2xs flex flex-col items-start gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-neutral-100">Couldn&apos;t load this supplier</h3>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-1 leading-relaxed">{profileError}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={fetchProfile}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-white dark:bg-gray-900 text-slate-700 dark:text-neutral-300 border-slate-200 dark:border-neutral-800 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        ) : !profile ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3">
            <div className="flex items-center gap-3.5">
              <Skeleton className="w-16 h-16 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-4">
            <div className="flex items-center gap-3.5">
              {/* Neutral logo box — initials from the real company name */}
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 border border-slate-200 dark:border-neutral-800 flex items-center justify-center shrink-0">
                {initials ? (
                  <span className="text-sm font-black text-slate-600 dark:text-neutral-400 dark:text-neutral-500 dark:text-gray-300">{initials}</span>
                ) : (
                  <Store className="h-6 w-6 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-base font-black text-slate-900 dark:text-neutral-100 leading-tight">
                    {profile.companyName}
                  </h1>
                  {profile.verificationStatus === 'approved' && (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {profile.verificationStatus === 'approved'
                    ? 'Verified supplier'
                    : `Verification status: ${profile.verificationStatus}`}
                </p>
              </div>
            </div>

            {(profile.warehouseCity || profile.warehouseDistrict) && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 font-medium">
                <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 dark:text-neutral-400 shrink-0" />
                <span>
                  {profile.warehouseCity}
                  {profile.warehouseCity && profile.warehouseDistrict ? ', ' : ''}
                  {profile.warehouseDistrict}
                </span>
              </div>
            )}

            {/* Stats Metric Strip — only metrics that exist in the database */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-neutral-800 bg-slate-50 dark:bg-background rounded-2xl p-3 text-center">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-xs font-black text-slate-900 dark:text-neutral-100">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  {profile.ratingCount > 0 ? profile.ratingAvg.toFixed(1) : '—'}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {profile.ratingCount > 0 ? `Rating (${profile.ratingCount})` : 'No ratings yet'}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-xs font-black text-slate-900 dark:text-neutral-100">
                  <Package className="h-3.5 w-3.5 text-primary/80" />
                  {profile.productCount.toLocaleString()}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Active Listings
                </span>
              </div>
            </div>

            {/* Contact Supplier Button */}
            <Button
              onClick={() => navigate('live-chat')}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <Mail className="h-4 w-4" />
              Contact Supplier
            </Button>
          </div>
        )}

        {/* Category Pills — derived from this supplier's real products */}
        {availableCategories.length >= 2 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-card'
              }`}
            >
              All Products
            </button>
            {availableCategories.map((name) => (
              <button
                key={name}
                onClick={() => setActiveCategory(name)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === name
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-card'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Products Header */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-neutral-100">
            All Products ({total.toLocaleString()})
          </h2>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 font-semibold">
            <span>Sorted by <strong className="text-slate-800 dark:text-neutral-200">Newest</strong></span>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-rose-200 shadow-2xs flex flex-col items-start gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-neutral-100">Couldn&apos;t load products</h3>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => fetchProducts(1, false)}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-white dark:bg-gray-900 text-slate-700 dark:text-neutral-300 border-slate-200 dark:border-neutral-800 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && <PageLoader />}

        {/* Empty — honest */}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-neutral-800 shadow-2xs text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 flex items-center justify-center mb-4">
              <Package className="h-9 w-9 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-neutral-100">
              {products.length === 0 ? 'No products listed yet' : 'No products in this category'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
              {products.length === 0
                ? 'This supplier hasn\u2019t published any approved listings yet. Their products will appear here as soon as they go live.'
                : 'Try the “All Products” filter to see everything this supplier lists.'}
            </p>
          </div>
        )}

        {/* Product Grid */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate('product-detail', { productId: p.id })}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-neutral-800 p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="aspect-square rounded-xl bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 overflow-hidden mb-2">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 w-full h-full">
                      <Package className="h-5 w-5 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-neutral-200 line-clamp-2 leading-snug">
                    {p.name}
                  </h3>
                  <div className="mt-1 text-sm font-black text-primary">
                    {formatPrice(p.basePrice)}
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-1 pt-1 border-t border-slate-50 gap-2">
                    <span className="truncate">MOQ: {p.moq.toLocaleString()} {p.unit}</span>
                    {p.soldCount > 0 && <span className="shrink-0">{p.soldCount.toLocaleString()} sold</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More — real pagination */}
        {!loading && !error && page < totalPages && (
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => fetchProducts(page + 1, true)}
              disabled={loadingMore}
              className="w-full bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-background dark:hover:bg-card text-slate-800 dark:text-neutral-200 border-slate-200 dark:border-neutral-800 font-bold text-xs h-11 rounded-2xl shadow-xs disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : `Load More (${total - products.length} remaining)`}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

export default SupplierProductsPage
