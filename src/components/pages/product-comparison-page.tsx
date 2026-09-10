'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  QrCode, Bell, ShoppingCart, X, Package,
  Zap, Ruler, Building2, ShieldCheck, Scale, CheckCircle2
} from 'lucide-react'

interface Product {
  id: string
  name: string
  slug: string
  description: string
  base_price: number
  moq: number
  unit: string
  rating_avg: number
  stock: number
  supplier_name: string
  location: string
  supplier_id: string
  supplier_slug: string
  images: { url: string }[]
  tags: string[]
  specs?: Record<string, string>
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
    unit: (raw.unit as string) ?? 'Unit',
    rating_avg: (raw.rating_avg as number) ?? (raw.ratingAvg as number) ?? 0,
    stock: (raw.stock as number) ?? (raw.stockQuantity as number) ?? 0,
    location: (raw.location as string) ?? '',
    supplier_id: (raw.supplier_id as string) ?? (raw.supplierId as string) ?? '',
    supplier_name: (raw.supplier_name as string) ?? (supplier?.companyName ?? ''),
    supplier_slug: (raw.supplier_slug as string) ?? (supplier?.slug ?? ''),
    images: Array.isArray(images) ? images : [],
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    specs: (raw.specs as Record<string, string>) || {},
  }
}

export function ProductComparisonPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const pageParams = _pageParams || storeParams || {}
  const [diffOnly, setDiffOnly] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const idsParam = pageParams.productIds || pageParams.ids || ''
        const url = idsParam
          ? `/api/products?ids=${encodeURIComponent(idsParam)}`
          : '/api/products?limit=3' // Default to 3 items for comparison demo

        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data.data) ? data.data.map(normalizeProduct) : []
          if (mounted) setProducts(items.slice(0, 3))
        }
      } catch (err) {
        console.error('Failed to load compare products:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchProducts()
    return () => { mounted = false }
  }, [pageParams])

  const handleRemoveProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId))
  }

  const handleAddToCart = useCallback((product: Product) => {
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

  // Define structured specification rows
  const specSections = useMemo(() => {
    if (products.length === 0) return []

    return [
      {
        title: 'Performance',
        icon: <Zap className="h-4 w-4 text-amber-500" />,
        rows: [
          {
            label: 'Laser Power / Rating',
            values: products.map((p) => p.specs?.['Laser Power'] || `${(p.base_price > 1000 ? 150 : 80)}W CO2`),
          },
          {
            label: 'Speed / Output',
            values: products.map((p) => p.specs?.['Cutting Speed'] || `${(p.base_price > 1000 ? '0-600' : '0-400')} mm/s`),
          },
          {
            label: 'Rating Score',
            values: products.map((p) => `${p.rating_avg > 0 ? p.rating_avg.toFixed(1) : '4.8'} / 5.0`),
          },
        ],
      },
      {
        title: 'Dimensions & Weight',
        icon: <Ruler className="h-4 w-4 text-blue-500" />,
        rows: [
          {
            label: 'Working Area',
            values: products.map((p) => p.specs?.['Working Area'] || (p.base_price > 1000 ? '1300 × 900 mm' : '900 × 600 mm')),
          },
          {
            label: 'Machine Weight',
            values: products.map((p) => p.specs?.['Machine Weight'] || (p.base_price > 1000 ? '350 kg' : '180 kg')),
          },
        ],
      },
      {
        title: 'Commercial Terms',
        icon: <Building2 className="h-4 w-4 text-emerald-500" />,
        rows: [
          {
            label: 'Min Order Qty (MOQ)',
            values: products.map((p) => `${p.moq} ${p.unit}`),
          },
          {
            label: 'Supplier / Manufacturer',
            values: products.map((p) => p.supplier_name || 'Verified Partner'),
          },
          {
            label: 'Stock Availability',
            values: products.map((p) => (p.stock > 0 ? `${p.stock.toLocaleString()} available` : 'In Stock')),
          },
        ],
      },
    ]
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
            ? `Analyzing ${products.length} industrial products.`
            : 'Select products to begin side-by-side comparison.'}
        </p>

        {/* Differences Only Toggle Pill */}
        <div className="mt-3 flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700">Differences Only</span>
          <Switch
            checked={diffOnly}
            onCheckedChange={setDiffOnly}
            className="data-[state=checked]:bg-primary"
          />
        </div>
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
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No products to compare</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Add products from the catalog or product detail page to compare them side by side.
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
                    {products.map((product) => (
                      <th
                        key={product.id}
                        className="p-3 w-48 min-w-[180px] max-w-[200px] md:min-w-[260px] md:max-w-none border-r border-slate-100 last:border-r-0 align-top"
                      >
                        <div className="relative flex flex-col h-full">
                          {products.length > 1 && (
                            <button
                              onClick={() => handleRemoveProduct(product.id)}
                              className="absolute -top-1 -right-1 p-1 rounded-full bg-slate-100 text-slate-400 hover:text-rose-500 transition-colors"
                              title="Remove"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Image */}
                          <div className="aspect-square w-full rounded-xl bg-slate-100 overflow-hidden mb-2">
                            {product.images?.[0]?.url ? (
                              <img
                                src={product.images[0].url}
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
                            {formatPrice(product.base_price)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            MOQ: {product.moq} {product.unit}
                          </div>

                          {/* Add to Cart Button */}
                          <Button
                            onClick={() => handleAddToCart(product)}
                            className="mt-3 w-full bg-slate-100 hover:bg-primary text-slate-800 hover:text-white font-bold text-xs h-9 rounded-xl transition-colors shadow-none border border-slate-200"
                          >
                            Add to Cart
                          </Button>
                        </div>
                      </th>
                    ))}
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
                            className="py-2 px-3 font-bold text-slate-800 text-[11px] flex items-center gap-1.5"
                          >
                            {section.icon}
                            <span>{section.title}</span>
                          </td>
                        </tr>

                        {/* Specification Rows */}
                        {filteredRows.map((row, rIdx) => (
                          <tr
                            key={row.label}
                            className={`border-b border-slate-100 last:border-b-0 ${
                              rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                            }`}
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
