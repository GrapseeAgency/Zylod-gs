'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, QrCode, Package, ChevronRight } from 'lucide-react'
import { useCurrencyStore } from '@/store/currency-store'

interface BarcodeProduct {
  id: string
  name: string
  sku: string
  basePrice: number
  thumbnailUrl?: string
  unit: string
  moq: number
  stockQuantity: number
  brand?: string
  supplier: { companyName: string; id: string }
  category: { name: string }
}

export function BarcodeResultPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const code = pageParams.code || ''
  const [product, setProduct] = useState<BarcodeProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (code) fetchProduct()
    else { setLoading(false); setNotFound(true) }
  }, [code])

  async function fetchProduct() {
    setLoading(true)
    try {
      const res = await fetch(`/api/search/barcode?code=${encodeURIComponent(code)}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) { setProduct(json.data); setNotFound(false) }
        else setNotFound(true)
      } else setNotFound(true)
    } catch { setNotFound(true) }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 flex items-center gap-3 px-4 py-3 md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
        <span className="font-semibold text-gray-900 flex-1">Scan Result</span>
        <button onClick={() => navigate('barcode-scanner')} className="text-xs text-red-600 font-medium">Scan Again</button>
      </div>

      <div className="flex-1 p-4 pb-20 md:p-6 md:pb-12 w-full max-w-2xl mx-auto md:max-w-4xl">
        {/* Desktop page heading (mobile uses the sticky bar above) */}
        <div className="hidden md:flex items-center gap-3 mb-6">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <span className="text-xl font-semibold text-gray-900 flex-1">Scan Result</span>
          <button onClick={() => navigate('barcode-scanner')} className="text-sm text-red-600 font-medium">Scan Again</button>
        </div>

        {/* Scanned code display */}
        <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2 mb-4">
          <QrCode className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <p className="text-xs text-gray-500">Scanned code:</p>
          <p className="text-xs font-mono font-medium text-gray-800 truncate">{code || 'N/A'}</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : notFound ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <Package className="w-12 h-12 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No product found for this code</p>
            <p className="text-xs text-gray-400 max-w-xs">The barcode or QR code doesn&apos;t match any product in our catalog</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => navigate('barcode-scanner')} className="px-3 py-2 bg-red-600 text-white text-sm rounded-xl font-medium">Scan Again</button>
              <button onClick={() => navigate('search-home')} className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-xl font-medium">Search Manually</button>
            </div>
          </div>
        ) : product ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 md:grid md:grid-cols-2 md:gap-8 md:space-y-0 md:items-start">
            {/* Product image */}
            <div className="aspect-square w-full bg-gray-100 rounded-2xl overflow-hidden">
              {product.thumbnailUrl ? (
                <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Package className="w-16 h-16 text-gray-200" /></div>
              )}
            </div>

            {/* Product info */}
            <div className="space-y-2">
              <h2 className="text-base md:text-2xl font-bold text-gray-900">{product.name}</h2>
              {product.brand && <p className="text-sm text-gray-500">Brand: {product.brand}</p>}
              <p className="text-xs text-gray-400">SKU: {product.sku}</p>
              <p className="text-xs text-gray-500">{product.supplier.companyName} · {product.category.name}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl md:text-3xl font-bold text-red-600">{formatPrice(product.basePrice)}</p>
                <p className="text-sm text-gray-500">per {product.unit}</p>
              </div>
              <p className="text-sm text-gray-600">Minimum order: <strong>{product.moq} {product.unit}</strong></p>
              <p className="text-sm text-gray-600">Stock: <strong className={product.stockQuantity > 0 ? 'text-green-600' : 'text-red-500'}>{product.stockQuantity > 0 ? `${product.stockQuantity} available` : 'Out of stock'}</strong></p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 md:col-span-2">
              <button
                onClick={() => navigate('product-detail', { productId: product.id })}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition">
                View Full Details
              </button>
              <button
                onClick={() => navigate('seller-storefront', { supplierId: product.supplier.id })}
                className="px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition">
                Supplier
              </button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}

export default BarcodeResultPage
