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
import { useAuthStore } from '@/store/auth-store'
import {
  Search, Package, ShoppingCart, ArrowLeft, ChevronRight,
  MapPin, BadgeCheck, Star, Eye, SlidersHorizontal, X,
  MessageSquare, Clock,
} from 'lucide-react'

const ITEMS_PER_PAGE = 8

interface CategoryProduct {
  id: string
  name: string
  slug: string
  description: string
  base_price: number
  moq: number
  unit: string
  rating_avg: number
  stock: number
  discount_percent: number
  tags: string[]
  location: string
  supplier_id: string
  supplier_name: string
  supplier_slug: string
  supplier_verified: boolean
  images: { url: string }[]
}

function normalizeApiProduct(raw: Record<string, unknown>): CategoryProduct {
  const supplier = raw.supplier as { companyName?: string; slug?: string; verified?: boolean } | undefined
  const images = raw.images as { url: string }[] | undefined
  return {
    id: (raw.id as string) ?? '',
    name: (raw.name as string) ?? '',
    slug: (raw.slug as string) ?? '',
    description: (raw.description as string) ?? '',
    base_price: (raw.base_price as number) ?? (raw.basePrice as number) ?? 0,
    moq: (raw.moq as number) ?? 1,
    unit: (raw.unit as string) ?? 'piece',
    rating_avg: (raw.rating_avg as number) ?? (raw.ratingAvg as number) ?? 0,
    stock: (raw.stock as number) ?? (raw.stockQuantity as number) ?? 0,
    discount_percent: (raw.discount_percent as number) ?? (raw.discountPercent as number) ?? 0,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    location: (raw.location as string) ?? '',
    supplier_id: (raw.supplier_id as string) ?? (raw.supplierId as string) ?? '',
    supplier_name: (raw.supplier_name as string) ?? (supplier?.companyName ?? ''),
    supplier_slug: (raw.supplier_slug as string) ?? (supplier?.slug ?? ''),
    supplier_verified: (raw.supplier_verified as boolean) ?? (supplier?.verified ?? false),
    images: Array.isArray(images) ? images : [],
  }
}

const CATEGORY_NAME_MAP: Record<string, string> = {
  'textiles-fabrics': 'Textiles & Fabrics',
  'agriculture-food': 'Agriculture & Food',
  'electronics': 'Electronics',
  'construction': 'Construction',
  'packaging': 'Packaging',
  'home-garden': 'Home & Garden',
  'gifts-crafts': 'Gifts & Crafts',
  'beauty-personal-care': 'Beauty & Personal Care',
  'promotional-items': 'Promotional Items',
  'garments': 'Garments',
  'spices': 'Spices',
  'mobile-accessories': 'Mobile Accessories',
  'led-lighting': 'LED Lighting',
  'automotive': 'Automotive',
  'sports-fitness': 'Sports & Fitness',
  'books-stationery': 'Books & Stationery',
  'toys': 'Toys',
  'jewelry': 'Jewelry',
  'medical-supplies': 'Medical Supplies',
  'furniture': 'Furniture',
  'industrial-parts': 'Industrial Parts',
}

const SUBCATEGORY_MAP: Record<string, string[]> = {
  'textiles-fabrics': ['All Parts', 'Cotton', 'Denim', 'Jute', 'Muslin', 'Terry Towels'],
  'agriculture-food': ['All Parts', 'Rice', 'Spices', 'Tea & Coffee', 'Frozen Fish', 'Honey'],
  'electronics': ['All Parts', 'Home Appliances', 'LED TVs', 'Solar Systems', 'Small Appliances'],
  'construction': ['All Parts', 'Cement', 'Steel', 'Tiles', 'Paint', 'Sanitary Ware'],
  'packaging': ['All Parts', 'Jute Bags', 'Cartons', 'Plastic Packaging', 'Glass Bottles'],
  'home-garden': ['All Parts', 'Ceramic Tiles', 'Toiletries', 'Plastic Products', 'Garden Tools'],
  'gifts-crafts': ['All Parts', 'Handicrafts', 'Jute Products', 'Embroidered Goods'],
  'beauty-personal-care': ['All Parts', 'Soap', 'Skincare', 'Hair Care', 'Fragrances'],
  'garments': ['All Parts', 'T-Shirts', 'Denim', 'Knitwear', 'Hoodies', 'Sportswear'],
  'automotive': ['All Parts', 'Parts', 'Accessories', 'Batteries', 'Tires'],
  'spices': ['All Parts', 'Turmeric', 'Chili', 'Ginger', 'Garam Masala', 'Herbal'],
  'mobile-accessories': ['All Parts', 'Phone Cases', 'Chargers', 'Cables', 'Earbuds'],
  'led-lighting': ['All Parts', 'LED Bulbs', 'Tube Lights', 'Panels', 'Street Lights'],
  'sports-fitness': ['All Parts', 'Equipment', 'Apparel', 'Footwear', 'Accessories'],
  'books-stationery': ['All Parts', 'Books', 'Notebooks', 'Pens', 'Office Supplies'],
  'toys': ['All Parts', 'Educational', 'Plush', 'Action Figures', 'Board Games'],
  'jewelry': ['All Parts', 'Gold', 'Silver', 'Pearl', 'Fashion', 'Handmade'],
  'medical-supplies': ['All Parts', 'Instruments', 'Disposables', 'Equipment', 'PPE'],
  'furniture': ['All Parts', 'Office', 'Home', 'Outdoor', 'Industrial', 'Custom'],
  'promotional-items': ['All Parts', 'Pens', 'Bags', 'Mugs', 'T-Shirts', 'Lanyards'],
  'industrial-parts': ['All Parts', 'Bearings & Bushings', 'Hydraulics', 'Pneumatics', 'Fasteners', 'Gear Systems'],
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'textiles-fabrics': 'Premium Bangladeshi textiles — from heritage muslin to industrial denim and jute. Direct from mills across Dhaka, Narayanganj, and Khulna.',
  'agriculture-food': 'Farm-fresh agriculture and food products from Bangladesh — spices, rice, tea, frozen seafood, and honey, packed for export.',
  'electronics': 'Quality electronics and home appliances at wholesale prices — LED TVs, solar systems, small appliances, and accessories.',
  'construction': 'Building materials for every project — cement, steel, tiles, paint, sanitary ware, and more, direct from manufacturers.',
  'packaging': 'Complete packaging solutions — jute bags, cartons, plastic packaging, glass bottles, and labels for every industry.',
  'home-garden': 'Home and garden essentials — ceramic tiles, toiletries, plastic products, and garden tools at wholesale rates.',
  'gifts-crafts': 'Authentic Bangladeshi handicrafts — jute goods, embroidery, and seasonal decor that tell a story of heritage.',
  'beauty-personal-care': 'Personal care and beauty products — soap, skincare, hair care, and fragrances made with natural ingredients.',
  'garments': "Ready-made garments from Bangladesh — the world's second-largest garment exporter. Apparel at factory prices.",
  'automotive': 'Automotive parts and accessories for cars, bikes, and commercial vehicles, sourced from trusted suppliers.',
  'spices': 'Aromatic Bangladeshi spices — turmeric, chili, ginger, and blended masalas, milled and packed for export.',
  'mobile-accessories': 'Mobile accessories that move fast — cases, chargers, cables, earbuds, and power banks at bulk prices.',
  'led-lighting': 'Energy-efficient LED lighting — bulbs, tubes, panels, street lights, and decorative lighting for every space.',
  'sports-fitness': 'Sports and fitness equipment, apparel, and accessories for retailers, gyms, and clubs.',
  'books-stationery': 'Books, notebooks, pens, and office supplies — everything a stationery retailer needs, in one place.',
  'toys': 'Educational toys, plush, action figures, and outdoor play for retailers and distributors.',
  'jewelry': 'Fine and fashion jewelry — gold, silver, pearl, and handmade pieces with authentic craftsmanship.',
  'medical-supplies': 'Medical supplies and instruments — disposables, equipment, diagnostics, and PPE from verified suppliers.',
  'furniture': 'Furniture for office, home, and industry — made in Bangladesh, ready to ship.',
  'promotional-items': 'Promotional products for branding — pens, bags, mugs, t-shirts, and lanyards, customizable at scale.',
  'industrial-parts': 'Heavy-duty components and specialized machinery parts sourced directly from verified manufacturers. Designed for rigorous industrial applications with guaranteed quality standards.',
}

/* ─── Filter Sheet Component ─── */
interface FilterSheetProps {
  open: boolean
  onClose: () => void
  onApply: (filters: FilterState) => void
  initialFilters: FilterState
  products: CategoryProduct[]
}

interface FilterState {
  priceMin: number
  priceMax: number
  certifications: string[]
  maxMoq: number
}

const CERTS = ['ISO 9001', 'CE Certified', 'RoHS Compliant', 'UL Listed']

function FilterSheet({ open, onClose, onApply, initialFilters, products }: FilterSheetProps) {
  const [priceMin, setPriceMin] = useState(initialFilters.priceMin)
  const [priceMax, setPriceMax] = useState(initialFilters.priceMax)
  const [certifications, setCertifications] = useState<string[]>(initialFilters.certifications)
  const [maxMoq, setMaxMoq] = useState(initialFilters.maxMoq)

  const maxPrice = useMemo(() => {
    if (products.length === 0) return 5000
    return Math.max(...products.map((p) => p.base_price), 100)
  }, [products])

  const maxMoqVal = useMemo(() => {
    if (products.length === 0) return 1000
    return Math.max(...products.map((p) => p.moq), 10)
  }, [products])

  const toggleCert = (cert: string) => {
    setCertifications((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    )
  }

  const handleReset = () => {
    setPriceMin(0)
    setPriceMax(maxPrice)
    setCertifications([])
    setMaxMoq(maxMoqVal)
  }

  const handleApply = () => {
    onApply({ priceMin, priceMax, certifications, maxMoq })
    onClose()
  }

  const filteredCount = useMemo(() => {
    return products.filter((p) => {
      if (p.base_price < priceMin || p.base_price > priceMax) return false
      if (maxMoq < maxMoqVal && p.moq > maxMoq) return false
      return true
    }).length
  }, [products, priceMin, priceMax, maxMoq, maxMoqVal])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[90vh] overflow-y-auto"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-base font-bold">Filters</h3>
              <button
                onClick={handleReset}
                className="text-sm font-semibold text-primary"
              >
                Reset
              </button>
            </div>

            <div className="px-4 py-4 space-y-6 pb-28">
              {/* Price Range */}
              <div>
                <h4 className="text-sm font-bold mb-3">Price Range (USD)</h4>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 mb-1 block">Min</label>
                    <input
                      type="number"
                      value={priceMin}
                      onChange={(e) => setPriceMin(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium"
                    />
                  </div>
                  <span className="text-gray-400 mt-4">–</span>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 mb-1 block">Max</label>
                    <input
                      type="number"
                      value={priceMax}
                      onChange={(e) => setPriceMax(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium"
                    />
                  </div>
                </div>
                <Slider
                  min={0}
                  max={maxPrice}
                  step={10}
                  value={[priceMin, priceMax]}
                  onValueChange={([min, max]) => { setPriceMin(min); setPriceMax(max) }}
                  className="mt-1"
                />
              </div>

              {/* Industry Certifications */}
              <div>
                <h4 className="text-sm font-bold mb-3">Industry Certifications</h4>
                <div className="flex flex-wrap gap-2">
                  {CERTS.map((cert) => (
                    <button
                      key={cert}
                      onClick={() => toggleCert(cert)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        certifications.includes(cert)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {cert}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max MOQ */}
              <div>
                <h4 className="text-sm font-bold mb-3">Max Minimum Order Quantity</h4>
                <div className="flex items-center gap-4">
                  <Slider
                    min={1}
                    max={maxMoqVal}
                    step={1}
                    value={[maxMoq]}
                    onValueChange={([val]) => setMaxMoq(val)}
                    className="flex-1"
                  />
                  <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                    ≤ {maxMoq}
                  </span>
                </div>
              </div>
            </div>

            {/* Show Results */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
              <Button
                onClick={handleApply}
                className="w-full bg-primary text-white font-bold h-12 rounded-xl text-sm"
              >
                Show {filteredCount.toLocaleString()} Results
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ═══ Page Component ─────────────────────────────────────────────── */
export function CategoryProductsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const { isAuthenticated } = useAuthStore()

  const pageParams = _pageParams || storeParams || {}
  const categorySlug = pageParams.category === 'all' ? '' : (pageParams.category || '')
  const categoryName =
    CATEGORY_NAME_MAP[categorySlug] ||
    (pageParams.category && pageParams.category !== 'all' ? pageParams.category : 'All Products')
  const subcategories = SUBCATEGORY_MAP[categorySlug] || ['All Parts']
  const categoryDescription =
    CATEGORY_DESCRIPTIONS[categorySlug] ||
    'Wholesale products direct from verified manufacturers and suppliers.'

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('popular')
  const [activeSubFilter, setActiveSubFilter] = useState(0)
  const [allProducts, setAllProducts] = useState<CategoryProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    priceMin: 0,
    priceMax: 9999999,
    certifications: [],
    maxMoq: 9999999,
  })

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setVisibleCount(ITEMS_PER_PAGE)

    const fetchProducts = async () => {
      try {
        const url = categorySlug
          ? `/api/products?category=${encodeURIComponent(categorySlug)}&limit=100`
          : '/api/products?limit=100'
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data = await res.json()
        const items = Array.isArray(data.data) ? data.data.map(normalizeApiProduct) : []
        if (mounted) {
          setAllProducts(items)
          setLoading(false)
        }
      } catch {
        if (mounted) {
          setAllProducts([])
          setLoading(false)
        }
      }
    }

    fetchProducts()
    return () => { mounted = false }
  }, [categorySlug])

  const categoryProducts = useMemo(() => {
    let items = allProducts
    if (activeSubFilter > 0) {
      const filter = subcategories[activeSubFilter]
      items = items.filter((p) => (p.tags ?? []).some((t) => t.toLowerCase().includes(filter.toLowerCase())))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    }
    // Apply filters
    items = items.filter((p) => {
      if (p.base_price < filters.priceMin) return false
      if (p.base_price > filters.priceMax) return false
      if (p.moq > filters.maxMoq) return false
      return true
    })
    const sorted = [...items]
    switch (sortBy) {
      case 'price_low': sorted.sort((a, b) => a.base_price - b.base_price); break
      case 'price_high': sorted.sort((a, b) => b.base_price - a.base_price); break
      case 'rating': sorted.sort((a, b) => b.rating_avg - a.rating_avg); break
      case 'newest': sorted.reverse(); break
      default: sorted.sort((a, b) => b.rating_avg - a.rating_avg)
    }
    return sorted
  }, [allProducts, activeSubFilter, searchQuery, sortBy, subcategories, filters])

  const visibleProducts = categoryProducts.slice(0, visibleCount)
  const hasMore = visibleCount < categoryProducts.length

  const handleAddToCart = useCallback(
    (product: CategoryProduct) => {
      addItem({
        id: `cart-${product.id}-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.images[0]?.url ?? null,
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
    },
    [addItem]
  )

  // Featured product = highest rated
  const featuredProduct = useMemo(() => {
    if (allProducts.length === 0) return null
    return [...allProducts].sort((a, b) => b.rating_avg - a.rating_avg)[0]
  }, [allProducts])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 pb-24 md:pb-8"
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center gap-3 px-4 md:px-6 py-3 max-w-7xl mx-auto">
          <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors md:hidden">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <span>Home</span>
              <ChevronRight className="h-3 w-3" />
              <span>Categories</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-gray-600 font-medium truncate">{categoryName}</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 md:px-6 pb-3 max-w-7xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${categoryName}...`}
              className="pl-9 h-10 text-sm rounded-xl border-gray-200 bg-gray-50"
            />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-4 md:pt-6 max-w-7xl mx-auto">
        {/* Category title + description */}
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">{categoryName}</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1 leading-relaxed">{categoryDescription}</p>
        </div>

        {/* Subcategory filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4 -mx-4 px-4 md:mx-0 md:px-0">
          {subcategories.map((sub, i) => (
            <button
              key={sub}
              onClick={() => setActiveSubFilter(i)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                i === activeSubFilter
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* Featured product hero card */}
        {!loading && featuredProduct && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm md:flex">
            <div className="relative md:w-1/2">
              <Badge className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md z-10">
                ★ Featured
              </Badge>
              <div className="h-44 md:h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                {featuredProduct.images[0]?.url ? (
                  <img
                    src={featuredProduct.images[0].url}
                    alt={featuredProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package className="h-16 w-16 text-gray-300" />
                )}
              </div>
            </div>
            <div className="p-4 md:w-1/2 md:p-6">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                {subcategories[activeSubFilter] !== 'All Parts' ? subcategories[activeSubFilter] : categoryName}
              </p>
              <h2 className="text-base font-bold text-gray-900 leading-snug mb-1">
                {featuredProduct.name}
              </h2>
              <p className="text-xs text-gray-500 line-clamp-2 mb-3">{featuredProduct.description}</p>
              <div className="text-xl font-bold text-primary mb-3">
                {formatPrice(featuredProduct.base_price)}
                <span className="text-sm font-normal text-gray-500 ml-1">/ {featuredProduct.unit}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-orange-500" />
                  <span>MOQ: {featuredProduct.moq} {featuredProduct.unit}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  <span>Lead Time: 7–10 Days</span>
                </div>
              </div>
              <Button
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate('login')
                    return
                  }
                  navigate('product-detail', { productId: featuredProduct.id })
                }}
                className="w-full bg-primary text-white font-bold h-11 rounded-xl text-sm"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Request Quote
              </Button>
            </div>
          </div>
        )}

        {/* Loading skeleton for featured */}
        {loading && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm">
            <Skeleton className="h-44 w-full rounded-none" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-7 w-28 mt-1" />
              <Skeleton className="h-11 w-full rounded-xl mt-2" />
            </div>
          </div>
        )}

        {/* Sort bar */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">
            All Products
            {!loading && (
              <span className="ml-2 text-gray-400 font-normal text-xs">
                Sort by: Popular ↓
              </span>
            )}
          </h3>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
          >
            <option value="popular">Popular</option>
            <option value="price_low">Price: Low–High</option>
            <option value="price_high">Price: High–Low</option>
            <option value="rating">Top Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border border-gray-100">
                <CardContent className="p-0">
                  <Skeleton className="aspect-square w-full rounded-none" />
                  <div className="p-2.5 space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-5 w-20 mt-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : categoryProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-sm font-bold text-gray-700 mb-1">No products found</h3>
            <p className="text-xs text-gray-400 mb-4">Try adjusting your filters or search term</p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-primary border-primary"
              onClick={() => {
                setSearchQuery('')
                setActiveSubFilter(0)
                setFilters({ priceMin: 0, priceMax: 9999999, certifications: [], maxMoq: 9999999 })
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card
                  className="overflow-hidden border border-gray-100 bg-white cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate('product-detail', { productId: product.id })}
                >
                  <CardContent className="p-0">
                    {/* Image */}
                    <div className="relative aspect-square bg-gray-100 flex items-center justify-center">
                      {product.images[0]?.url ? (
                        <img
                          src={product.images[0].url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-8 w-8 text-gray-300" />
                      )}
                      {product.discount_percent > 0 && (
                        <div className="absolute top-1.5 left-1.5 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          -{product.discount_percent}%
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-2.5">
                      <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">
                        {product.name}
                      </h3>
                      <p className="text-[10px] text-gray-400 mb-1">
                        MOQ: {product.moq} {product.unit}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary">
                          {formatPrice(product.base_price)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddToCart(product)
                          }}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-primary hover:text-white transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate('product-detail', { productId: product.id })
                        }}
                        className="mt-2 w-full text-center text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                      >
                        MOQ
                        <span className="text-primary font-bold">{product.moq}</span>
                        <span className="text-gray-400">View</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Load More */}
        {!loading && hasMore && (
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              className="text-primary border-primary font-semibold text-sm px-8"
              onClick={() => setVisibleCount((c) => c + ITEMS_PER_PAGE)}
            >
              Load More Products
            </Button>
          </div>
        )}
      </div>

      {/* Floating Filters Button */}
      {!loading && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-2 bg-white text-gray-800 font-semibold text-sm px-5 py-2.5 rounded-full shadow-lg border border-gray-200"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {(filters.certifications.length > 0 || filters.maxMoq < 9999999 || filters.priceMin > 0) && (
              <span className="bg-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                !
              </span>
            )}
          </button>
        </div>
      )}

      {/* Filter Bottom Sheet */}
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={setFilters}
        initialFilters={filters}
        products={allProducts}
      />
    </motion.div>
  )
}
