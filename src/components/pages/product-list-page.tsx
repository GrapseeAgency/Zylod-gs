'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import { useWishlistStore } from '@/store/wishlist-store'
import {
  Search, SlidersHorizontal, QrCode, Bell, LayoutGrid, List,
  ShoppingCart, Heart, X, Check, Package
} from 'lucide-react'

interface Product {
  id: string
  name: string
  slug: string
  description: string
  base_price: number
  moq: number
  unit: string
  discount_percent: number
  supplier_id: string
  supplier_name: string
  supplier_slug: string
  images: { url: string }[]
  tags: string[]
}

function normalizeProduct(raw: Record<string, unknown>): Product {
  const supplier = raw.supplier as { companyName?: string; slug?: string } | undefined
  const images = raw.images as { url: string }[] | undefined
  return {
    id: (raw.id as string) ?? '',
    name: (raw.name as string) ?? '',
    slug: (raw.slug as string) ?? '',
    description: (raw.description as string) ?? '',
    base_price: (raw.base_price as number) ?? (raw.basePrice as number) ?? 0,
    moq: (raw.moq as number) ?? 1,
    unit: (raw.unit as string) ?? 'units',
    discount_percent: (raw.discount_percent as number) ?? (raw.discountPercent as number) ?? 0,
    supplier_id: (raw.supplier_id as string) ?? (raw.supplierId as string) ?? '',
    supplier_name: (raw.supplier_name as string) ?? (supplier?.companyName ?? ''),
    supplier_slug: (raw.supplier_slug as string) ?? (supplier?.slug ?? ''),
    images: Array.isArray(images) ? images : [],
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
  }
}

interface FilterState {
  priceMin: number
  priceMax: number
  certifications: string[]
  brands: string[]
  maxMoq: number
}

const CERTS = ['ISO 9001', 'CE Certified', 'RoHS Compliant', 'UL Listed']

export function ProductListPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const { toggleItem, isInWishlist } = useWishlistStore()

  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)

  const [filters, setFilters] = useState<FilterState>({
    priceMin: 0,
    priceMax: 10000,
    certifications: [],
    brands: [],
    maxMoq: 1000,
  })

  // Temporary filter state for bottom sheet
  const [tempFilters, setTempFilters] = useState<FilterState>(filters)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch('/api/categories'),
          fetch(`/api/products?limit=50${activeCategory !== 'all' ? `&category=${activeCategory}` : ''}`)
        ])

        if (catRes.ok) {
          const catData = await catRes.json()
          if (mounted && Array.isArray(catData.data || catData)) {
            setCategories(catData.data || catData)
          }
        }

        if (prodRes.ok) {
          const prodData = await prodRes.json()
          const items = Array.isArray(prodData.data) ? prodData.data.map(normalizeProduct) : []
          if (mounted) {
            setProducts(items)
          }
        }
      } catch (err) {
        console.error('Failed to load products:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()
    return () => { mounted = false }
  }, [activeCategory])

  const availableBrands = useMemo(() => {
    const brandMap = new Map<string, number>()
    products.forEach(p => {
      if (p.supplier_name) {
        brandMap.set(p.supplier_name, (brandMap.get(p.supplier_name) || 0) + 1)
      }
    })
    return Array.from(brandMap.entries()).map(([name, count]) => ({ name, count }))
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const match = p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
        if (!match) return false
      }
      if (p.base_price < filters.priceMin || p.base_price > filters.priceMax) return false
      if (filters.brands.length > 0 && !filters.brands.includes(p.supplier_name)) return false
      if (p.moq > filters.maxMoq) return false
      return true
    })
  }, [products, searchQuery, filters])

  const handleAddToCart = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation()
    addItem({
      id: `cart-${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.images[0]?.url || null,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity: product.moq,
      unitPrice: product.base_price,
      totalPrice: product.base_price * product.moq,
      moq: product.moq,
      maxOrderQty: null,
      supplierId: product.supplier_id,
      supplierName: product.supplier_name,
      supplierSlug: product.supplier_slug,
      unit: product.unit,
      priceTiers: [],
    })
  }, [addItem])

  const handleToggleWishlist = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation()
    toggleItem({
      id: product.id,
      name: product.name,
      price: product.base_price,
      originalPrice: product.base_price,
      moq: product.moq,
      unit: product.unit,
      supplier: product.supplier_name,
      location: '',
      category: '',
      customizable: false
    })
  }, [toggleItem])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:px-6">
        <div className="flex items-center justify-between mb-3 md:hidden md:max-w-7xl md:mx-auto">
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Scan QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700 hover:text-slate-900 relative" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center md:max-w-3xl md:mx-auto md:my-3">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog..."
            className="pl-10 pr-10 h-11 bg-slate-50 border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus-visible:ring-primary"
          />
          <button className="absolute right-3 p-1 text-slate-400 hover:text-slate-600">
            <QrCode className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Category Pills & View Mode */}
      <div className="px-4 py-3 flex items-center justify-between gap-2 overflow-hidden md:px-6 md:max-w-7xl md:mx-auto md:w-full">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCategory === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id || c.slug}
              onClick={() => setActiveCategory(c.slug)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === c.slug
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-white shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Product Grid / List */}
      <main className="px-4 md:px-6 md:max-w-7xl md:mx-auto md:w-full">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 border border-slate-100 space-y-2">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-100 mt-2">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No products found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              We couldn't find any products matching your current filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs font-semibold text-primary border-primary hover:bg-primary/5"
              onClick={() => {
                setFilters({ priceMin: 0, priceMax: 10000, certifications: [], brands: [], maxMoq: 1000 })
                setSearchQuery('')
                setActiveCategory('all')
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filteredProducts.map((product) => {
              const inWish = isInWishlist(product.id)
              return (
                <div
                  key={product.id}
                  onClick={() => navigate('product-detail', { productId: product.id })}
                  className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative aspect-square bg-slate-100 overflow-hidden">
                    {product.images?.[0]?.url ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="h-10 w-10" />
                      </div>
                    )}
                    {product.discount_percent > 0 ? (
                      <Badge className="absolute top-2 left-2 bg-white/90 text-primary border-none text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-xs">
                        -{product.discount_percent}% VOL
                      </Badge>
                    ) : null}
                    <button
                      onClick={(e) => handleToggleWishlist(e, product)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-xs text-slate-600 hover:text-primary transition-colors"
                    >
                      <Heart className={`h-3.5 w-3.5 ${inWish ? 'fill-primary text-primary' : ''}`} />
                    </button>
                  </div>

                  <div className="p-3 flex flex-col flex-1 justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight">
                        {product.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        MOQ: {product.moq} {product.unit}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-1 border-t border-slate-50">
                      <div>
                        <span className="text-sm font-black text-primary">
                          {formatPrice(product.base_price)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">/ea</span>
                      </div>
                      <button
                        onClick={(e) => handleAddToCart(e, product)}
                        className="p-2 rounded-full bg-slate-100 text-slate-700 hover:bg-primary hover:text-white transition-colors"
                        title="Add to cart"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => navigate('product-detail', { productId: product.id })}
                className="bg-white rounded-2xl border border-slate-100 p-3 shadow-2xs hover:shadow-md transition-all flex gap-3 cursor-pointer items-center"
              >
                <div className="relative w-24 h-24 rounded-xl bg-slate-100 shrink-0 overflow-hidden">
                  {product.images?.[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                  {product.discount_percent > 0 && (
                    <span className="absolute top-1 left-1 bg-primary text-white text-[9px] font-bold px-1 rounded">
                      -{product.discount_percent}%
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between h-24 py-0.5">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 line-clamp-1">
                      {product.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      MOQ: {product.moq} {product.unit} • {product.supplier_name || 'Verified Supplier'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm font-black text-primary">
                      {formatPrice(product.base_price)}
                      <span className="text-[10px] text-slate-400 font-normal"> / {product.unit}</span>
                    </span>
                    <button
                      onClick={(e) => handleAddToCart(e, product)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1 hover:bg-primary/90 transition-colors"
                    >
                      <ShoppingCart className="h-3 w-3" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Filter Button */}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-20">
        <button
          onClick={() => {
            setTempFilters(filters)
            setFilterOpen(true)
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-slate-800 font-bold text-xs shadow-lg border border-slate-200 hover:bg-slate-50 transition-transform active:scale-95"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </button>
      </div>

      {/* Filter Bottom Sheet Modal */}
      <AnimatePresence>
        {filterOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFilterOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto flex flex-col p-5 shadow-2xl z-10"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 shrink-0" />

              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Filters</h3>
                <button
                  onClick={() => {
                    const resetState = { priceMin: 0, priceMax: 10000, certifications: [], brands: [], maxMoq: 1000 }
                    setTempFilters(resetState)
                    setFilters(resetState)
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Reset
                </button>
              </div>

              {/* Filter Body */}
              <div className="py-4 space-y-6">
                {/* Price Range */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Price Range (USD)
                  </h4>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 font-medium">Min</label>
                      <Input
                        type="number"
                        value={tempFilters.priceMin}
                        onChange={(e) => setTempFilters({ ...tempFilters, priceMin: Number(e.target.value) })}
                        className="h-10 text-xs font-semibold rounded-xl"
                      />
                    </div>
                    <span className="text-slate-400 mt-4">-</span>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 font-medium">Max</label>
                      <Input
                        type="number"
                        value={tempFilters.priceMax}
                        onChange={(e) => setTempFilters({ ...tempFilters, priceMax: Number(e.target.value) })}
                        className="h-10 text-xs font-semibold rounded-xl"
                      />
                    </div>
                  </div>
                  <Slider
                    defaultValue={[tempFilters.priceMin, tempFilters.priceMax]}
                    max={10000}
                    step={50}
                    onValueChange={([min, max]) => setTempFilters({ ...tempFilters, priceMin: min, priceMax: max })}
                    className="py-2"
                  />
                </div>

                {/* Certifications */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Industry Certifications
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {CERTS.map((cert) => {
                      const selected = tempFilters.certifications.includes(cert)
                      return (
                        <button
                          key={cert}
                          onClick={() => {
                            setTempFilters({
                              ...tempFilters,
                              certifications: selected
                                ? tempFilters.certifications.filter((c) => c !== cert)
                                : [...tempFilters.certifications, cert]
                            })
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            selected
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cert}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Brands */}
                {availableBrands.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Brands & Suppliers
                    </h4>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {availableBrands.map((b) => {
                        const checked = tempFilters.brands.includes(b.name)
                        return (
                          <label
                            key={b.name}
                            className="flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                onClick={() => {
                                  setTempFilters({
                                    ...tempFilters,
                                    brands: checked
                                      ? tempFilters.brands.filter((brand) => brand !== b.name)
                                      : [...tempFilters.brands, b.name]
                                  })
                                }}
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                  checked ? 'bg-primary border-primary text-white' : 'border-slate-300'
                                }`}
                              >
                                {checked && <Check className="h-3 w-3" />}
                              </div>
                              <span>{b.name}</span>
                            </div>
                            <span className="text-slate-400 text-[10px]">({b.count})</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Max MOQ */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Max Minimum Order Quantity
                    </h4>
                    <span className="text-xs font-bold text-slate-700">≤ {tempFilters.maxMoq}</span>
                  </div>
                  <Slider
                    defaultValue={[tempFilters.maxMoq]}
                    max={1000}
                    step={10}
                    onValueChange={([val]) => setTempFilters({ ...tempFilters, maxMoq: val })}
                    className="py-2"
                  />
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="pt-3 border-t border-slate-100 mt-auto">
                <Button
                  onClick={() => {
                    setFilters(tempFilters)
                    setFilterOpen(false)
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl text-sm shadow-md"
                >
                  Show Results
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
