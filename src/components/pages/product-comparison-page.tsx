'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  QrCode, Bell, ShoppingCart, X, Package,
  Zap, Building2, Scale
} from 'lucide-react'

/**
 * Product comparison — data comes exclusively from the real compare API
 * (`/api/products/compare?productIds=...`). There is no demo fetch when no
 * products are selected, and every spec row is a real value or an honest
 * placeholder ("—"). Nothing is derived from price heuristics.
 */

interface CompareProduct {
  id: string
  name: string
  slug: string
  basePrice: number
  unit: string
  moq: number
  stockQuantity: number
  image: string | null
  thumbnailUrl?: string | null
  supplier: { id: string; companyName: string; verificationStatus: string; ratingAvg: number } | null
  specifications: { specName: string; specValue: string }[]
  avgRating: number
  totalReviews: number
  priceTiers: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
}

interface CompareApiResponse {
  success?: boolean
  error?: string
  data?: { products: CompareProduct[]; totalItems: number }
}

interface SpecRow {
  label: string
  values: string[]
}

interface SpecSection {
  title: string
  icon: React.ReactNode
  rows: SpecRow[]
}

function productImage(p: CompareProduct): string | null {
  return p.image || p.thumbnailUrl || null
}

export function ProductComparisonPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const pageParams = _pageParams || storeParams || {}
  const [diffOnly, setDiffOnly] = useState(false)
  const [products, setProducts] = useState<CompareProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const idsKey = (pageParams.productIds || pageParams.ids || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .slice(0, 4)
    .join(',')

  useEffect(() => {
    let mounted = true
    const ids = idsKey ? idsKey.split(',') : []

    const fetchProducts = async () => {
      // Honest empty state — never fetch arbitrary products as a "demo"
      if (ids.length === 0) {
        setProducts([])
        setLoadError('')
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError('')
      try {
        const res = await fetch(`/api/products/compare?productIds=${encodeURIComponent(ids.join(','))}`)
        const json: CompareApiResponse = await res.json().catch(() => null)
        if (!mounted) return
        if (res.ok && json?.success && json.data) {
          setProducts(json.data.products || [])
        } else {
          setProducts([])
          setLoadError(json?.error || `Could not load products for comparison (HTTP ${res.status})`)
        }
      } catch (err) {
        console.error('Failed to load compare products:', err)
        if (mounted) {
          setProducts([])
          setLoadError('Could not reach the comparison service')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchProducts()
    return () => { mounted = false }
  }, [idsKey])

  const handleRemoveProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId))
  }

  const handleAddToCart = useCallback((product: CompareProduct) => {
    addItem({
      id: `cart-${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: productImage(product),
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity: product.moq,
      unitPrice: product.basePrice,
      totalPrice: product.basePrice * product.moq,
      moq: product.moq,
      maxOrderQty: null,
      supplierId: product.supplier?.id ?? '',
      supplierName: product.supplier?.companyName ?? '',
      supplierSlug: '',
      unit: product.unit,
      priceTiers: product.priceTiers || [],
    })
  }, [addItem])

  // Spec rows built ONLY from real data returned by the compare API
  const specSections = useMemo(() => {
    if (products.length === 0) return []

    const sections: SpecSection[] = []

    // Real specification rows — union of spec names across the compared products
    const specNames: string[] = []
    for (const p of products) {
      for (const spec of p.specifications || []) {
        if (spec.specName && !specNames.includes(spec.specName)) specNames.push(spec.specName)
      }
    }
    if (specNames.length > 0) {
      sections.push({
        title: 'Specifications',
        icon: <Zap className="h-4 w-4 text-amber-500" />,
        rows: specNames.map((specName) => ({
          label: specName,
          values: products.map((p) => {
            const spec = (p.specifications || []).find(s => s.specName === specName)
            return spec?.specValue?.trim() ? spec.specValue : '—'
          }),
        })),
      })
    }

    sections.push({
      title: 'Commercial Terms',
      icon: <Building2 className="h-4 w-4 text-emerald-500" />,
      rows: [
        {
          label: 'Rating',
          values: products.map((p) =>
            p.totalReviews > 0 && p.avgRating > 0
              ? `${p.avgRating.toFixed(1)} / 5.0 (${p.totalReviews} review${p.totalReviews === 1 ? '' : 's'})`
              : 'No ratings yet'
          ),
        },
        {
          label: 'Supplier / Manufacturer',
          values: products.map((p) => p.supplier?.companyName || '—'),
        },
        {
          label: 'Min Order Qty (MOQ)',
          values: products.map((p) => `${p.moq} ${p.unit}`),
        },
        {
          label: 'Stock Availability',
          values: products.map((p) =>
            p.stockQuantity > 0 ? `${p.stockQuantity.toLocaleString()} available` : 'Out of stock'
          ),
        },
      ],
    })

    return sections
  }, [products])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700 hover:text-slate-900" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700 hover:text-slate-900 relative" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Page Title & Intro */}
      <div className="px-4 pt-4 pb-2 bg-white md:px-6 md:pt-6 md:max-w-7xl md:mx-auto md:w-full">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Compare Products</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {products.length > 0
            ? `Comparing ${products.length} product${products.length === 1 ? '' : 's'} side by side.`
            : 'Select products to begin side-by-side comparison.'}
        </p>

        {/* Differences Only Toggle Pill */}
        {products.length > 0 && (
          <div className="mt-3 flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Differences Only</span>
            <Switch
              checked={diffOnly}
              onCheckedChange={setDiffOnly}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        )}
      </div>

      {/* Main Table */}
      <main className="mt-3 px-3 md:px-6 md:mt-4 md:max-w-7xl md:mx-auto">
        {loading ? (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-4">
            <div className="flex gap-4">
              <Skeleton className="w-1/3 h-48 rounded-xl" />
              <Skeleton className="w-2/3 h-48 rounded-xl" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-100">
            <Scale className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">
              {loadError ? 'Comparison unavailable' : 'No products to compare'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {loadError ||
                'Add products from the catalog or product detail page to compare them side by side.'}
            </p>
            <Button
              onClick={() => navigate('product-list')}
              className="mt-4 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl"
            >
              Browse Catalog
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full border-collapse text-left text-xs md:text-sm">
                {/* Header Row with Product Cards */}
                <thead>
                  <tr className="border-b border-slate-200">
                    {/* Sticky Label Column Header */}
                    <th className="p-3 w-32 min-w-[120px] md:min-w-[180px] bg-slate-50 border-r border-slate-200 align-bottom">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Specifications
                      </span>
                    </th>

                    {/* Product Columns */}
                    {products.map((product) => {
                      const img = productImage(product)
                      return (
                        <th
                          key={product.id}
                          className="p-3 w-48 min-w-[180px] max-w-[200px] md:min-w-[260px] md:max-w-none border-r border-slate-100 last:border-r-0 align-top"
                        >
                          <div className="relative flex flex-col h-full">
                            {products.length > 1 && (
                              <button
                                onClick={() => handleRemoveProduct(product.id)}
                                className="absolute -top-1 -right-1 p-1 rounded-full bg-slate-100 text-slate-400 hover:text-rose-500 transition-colors z-10"
                                title="Remove"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Image — neutral block when the product has none */}
                            <div className="aspect-square w-full rounded-xl bg-slate-100 overflow-hidden mb-2">
                              {img ? (
                                <img
                                  src={img}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                  <Package className="h-8 w-8" />
                                </div>
                              )}
                            </div>

                            {/* Name & Pricing */}
                            <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                              {product.name}
                            </h4>
                            <div className="mt-1 text-sm font-black text-primary">
                              {formatPrice(product.basePrice)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              MOQ: {product.moq} {product.unit}
                            </div>

                            {/* Add to Cart Button */}
                            <Button
                              onClick={() => handleAddToCart(product)}
                              className="mt-3 w-full bg-slate-100 hover:bg-primary text-slate-800 hover:text-white font-bold text-xs h-9 rounded-xl transition-colors shadow-none border border-slate-200"
                            >
                              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                              Add to Cart
                            </Button>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                {/* Spec Sections & Rows */}
                <tbody>
                  {specSections.map((section) => {
                    const filteredRows = diffOnly
                      ? section.rows.filter((row) => {
                          const firstVal = row.values[0]
                          return row.values.some((v) => v !== firstVal)
                        })
                      : section.rows

                    if (filteredRows.length === 0) return null

                    return (
                      <React.Fragment key={section.title}>
                        {/* Section Header */}
                        <tr className="bg-slate-100/70 border-b border-t border-slate-200">
                          <td
                            colSpan={products.length + 1}
                            className="py-2 px-3 font-bold text-slate-800 text-[11px]"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {section.icon}
                              <span>{section.title}</span>
                            </span>
                          </td>
                        </tr>

                        {/* Specification Rows */}
                        {filteredRows.map((row) => (
                          <tr
                            key={row.label}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <td className="p-3 font-semibold text-slate-600 border-r border-slate-200 bg-slate-50/70 text-[11px]">
                              {row.label}
                            </td>
                            {row.values.map((val, vIdx) => (
                              <td
                                key={vIdx}
                                className="p-3 text-slate-800 font-medium border-r border-slate-100 last:border-r-0 text-[11px]"
                              >
                                {val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ProductComparisonPage
