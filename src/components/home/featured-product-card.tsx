'use client'

import React from 'react'
import { Package, Star, MapPin } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { ProductQRCodeTrigger } from '@/components/shared/product-qr-code'
import { ProductShareDialogTrigger } from '@/components/shared/product-share-dialog'

/* ─── Color Constants ─── */
const RED = '#E53935'


/* ─── Product Color Themes (for image placeholder) ─── */
const PRODUCT_COLORS: Record<string, { bg: string; accent: string }> = {
  'fp-1': { bg: 'linear-gradient(135deg, #FFE0E0, #FFF5F5)', accent: 'primary' },
  'fp-2': { bg: 'linear-gradient(135deg, #E8F5E9, #F1F8E9)', accent: '#388E3C' },
  'fp-3': { bg: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', accent: '#1976D2' },
  'fp-4': { bg: 'linear-gradient(135deg, #FFF8E1, #FFECB3)', accent: '#F9A825' },
  'fp-5': { bg: 'linear-gradient(135deg, #FBE9E7, #FFCCBC)', accent: 'primary' },
  'fp-6': { bg: 'linear-gradient(135deg, #F3E5F5, #E1BEE7)', accent: '#7B1FA2' },
  'fp-7': { bg: 'linear-gradient(135deg, #E0F2F1, #B2DFDB)', accent: '#00897B' },
  'fp-8': { bg: 'linear-gradient(135deg, #E8EAF6, #C5CAE9)', accent: '#3F51B5' },
  'fp-9': { bg: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)', accent: '#EF6C00' },
  'fp-10': { bg: 'linear-gradient(135deg, #FCE4EC, #F8BBD0)', accent: '#C62828' },
  'fp-11': { bg: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)', accent: '#2E7D32' },
  'fp-12': { bg: 'linear-gradient(135deg, #FFFDE7, #FFF9C4)', accent: '#F57F17' },
  'fp-13': { bg: 'linear-gradient(135deg, #F3E5F5, #CE93D8)', accent: '#AD1457' },
}

/* ─── Type ─── */
export interface FeaturedProduct {
  id: string
  name: string
  price: number
  originalPrice: number
  moq: number
  sold: number
  badge: string
  badgeColor: string
  location: string
}

export function FeaturedProductCard({ product }: { product: FeaturedProduct }) {
  const { setCurrentPage } = useNavigationStore()
  const { formatPrice, currentCurrency } = useCurrencyStore()
  const colorTheme = PRODUCT_COLORS[product.id] || { bg: 'linear-gradient(135deg, #F5F5F5, #E0E0E0)', accent: '#9E9E9E' }

  const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)

  return (
    <div
      className="group min-w-[200px] max-w-[200px] bg-card rounded-lg border border-gray-100 overflow-hidden flex-shrink-0 transition-all duration-200 hover:-translate-y-1.5 hover:shadow-lg hover:border-red-200"
    >
      {/* Badge Banner */}
      <div
        className="relative h-[140px] flex items-center justify-center cursor-pointer"
        style={{ background: colorTheme.bg }}
        onClick={() => setCurrentPage('product-detail', { productId: product.id })}
      >
        {/* Status Badge */}
        <span className={`absolute top-2 left-2 px-2.5 py-1 text-[11px] font-bold text-white rounded-md shadow-sm ${product.badgeColor}`}>
          {product.badge}
        </span>

        {/* Discount Badge */}
        <span
          className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold text-white rounded-md"
          style={{ background: RED }}
        >
          -{discountPercent}%
        </span>

        {/* Product Icon */}
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110"
          style={{ background: `${colorTheme.accent}20` }}
        >
          <Package className="h-7 w-7" style={{ color: colorTheme.accent }} />
        </div>

        {/* QR + Share hover overlay */}
        <div
          className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <ProductQRCodeTrigger productId={product.id} productName={product.name} />
          <ProductShareDialogTrigger productId={product.id} productName={product.name} productPrice={product.price} />
        </div>
      </div>
      <div className="p-3 cursor-pointer" onClick={() => setCurrentPage('product-detail', { productId: product.id })}>
        <p className="text-xs text-gray-800 font-semibold leading-tight line-clamp-2 h-8 mb-1.5 group-hover:text-red-600 transition-colors">{product.name}</p>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-sm font-bold" style={{ color: 'primary' }}>{formatPrice(product.price)}</span>
          <span className="text-[10px] text-gray-400 line-through">{formatPrice(product.originalPrice)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
          <span className="font-medium">MOQ: {product.moq}</span>
          <span className="font-medium">{product.sold >= 1000 ? `${(product.sold / 1000).toFixed(1)}k` : product.sold} sold</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <MapPin className="h-3 w-3" />
          <span>{product.location}</span>
        </div>
      </div>
    </div>
  )
}
