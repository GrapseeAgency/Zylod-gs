'use client'

/**
 * Product Specifications page (Task 92 rewrite) — this page previously
 * FABRICATED an entire spec sheet for every product (hardcoded racking
 * steel grades, dimensions and an "ISO 9001 / CE" certification array
 * rendered no matter what the product actually was). That fabrication is
 * gone. Everything rendered now comes from the real rails:
 *
 *   - Identity (name / SKU / image) from the real product row
 *     (404 → honest not-found, never a stand-in product).
 *   - Specifications from the real productSpecifications table via
 *     GET /api/products/[id]/specifications (the same grouped feed the
 *     PDP Specifications tab consumes).
 *   - Certifications from the real productCertifications table via the
 *     shared ProductCertifications component (server-computed Valid /
 *     Expiring soon / Expired badges, document links) — empty when the
 *     supplier filed nothing, never padded with invented claims.
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { ProductCertifications } from '@/components/product/product-certifications'
import {
  QrCode, Bell, FileText, Wrench, Ruler,
  Download, Package, ArrowLeft, AlertCircle, Info,
} from 'lucide-react'

interface ProductData {
  id: string
  name: string
  sku: string
  images: { url: string }[]
}

export function ProductSpecificationsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || pageParams.id || ''

  const [product, setProduct] = useState<ProductData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [groupedSpecs, setGroupedSpecs] = useState<Record<string, Array<{ specName: string; specValue: string }>>>({})

  useEffect(() => {
    let mounted = true
    const fetchProduct = async () => {
      setLoading(true)
      setNotFound(false)
      try {
        if (!productId) {
          if (mounted) setNotFound(true)
          return
        }
        const res = await fetch(`/api/products/${productId}`)
        if (!res.ok) {
          if (mounted) setNotFound(true)
          return
        }
        const data = await res.json()
        const p = data.data || (Array.isArray(data) ? data[0] : data)
        if (mounted && p) {
          setProduct({
            id: p.id || '',
            name: p.name || '',
            sku: p.sku || '',
            images: Array.isArray(p.images) ? p.images : [],
          })
        }
        // Real grouped specifications (same feed the PDP tab consumes)
        const specRes = await fetch(`/api/products/${productId}/specifications`)
        if (specRes.ok) {
          const specJson = await specRes.json()
          if (mounted && specJson?.success && specJson.data?.groupedSpecifications) {
            setGroupedSpecs(specJson.data.groupedSpecifications)
          }
        }
      } catch (e) {
        console.error('Failed to load specifications:', e)
        if (mounted) setNotFound(true)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchProduct()
    return () => { mounted = false }
  }, [productId])

  const handleDownloadPDF = () => {
    // Downloads the REAL product record (identity + grouped specs) — no
    // invented data sheet, just what the platform actually stores.
    const payload = {
      product: product ? { id: product.id, name: product.name, sku: product.sku } : null,
      specifications: groupedSpecs,
    }
    const element = document.createElement('a')
    const file = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    element.href = URL.createObjectURL(file)
    element.download = `${product?.sku || 'Product'}-specifications.json`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const specGroupCount = Object.keys(groupedSpecs).length
  const specRowCount = Object.values(groupedSpecs).reduce((n, rows) => n + rows.length, 0)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700 dark:text-slate-300" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button onClick={() => navigate("notifications")} className="p-1 text-slate-700 dark:text-slate-300" title="Notifications" aria-label="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>

        <button
          onClick={goBack}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:text-slate-100 pt-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Product
        </button>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-8 md:space-y-6">
        <button
          onClick={goBack}
          className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:text-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Product
        </button>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ) : notFound || !product ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-slate-300" />
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Product not found</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              This product may have been removed or is no longer publicly visible.
            </p>
            <Button onClick={goBack} variant="outline" className="h-9 rounded-xl text-xs font-bold">
              Go back
            </Button>
          </div>
        ) : (
          <>
            {/* Title & SKU */}
            <div>
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                {product.name}
              </h1>
              {product.sku && (
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wider">
                  SKU: {product.sku}
                </p>
              )}
            </div>

            {/* Download the real record */}
            <Button
              onClick={handleDownloadPDF}
              className="w-full md:w-auto md:px-10 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <Download className="h-4 w-4" />
              Download specification record
            </Button>

            {/* Hero Image */}
            <div className="w-full h-52 rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              {product.images?.[0]?.url ? (
                <img
                  src={product.images[0].url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Package className="h-12 w-12" />
                </div>
              )}
            </div>

            {/* Section 1: Real specifications, grouped */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="bg-slate-100 dark:bg-slate-900/70 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Specifications</h3>
                {specRowCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {specRowCount} field{specRowCount === 1 ? '' : 's'} · {specGroupCount} group{specGroupCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {specRowCount === 0 ? (
                <div className="p-5 flex items-start gap-3">
                  <Info className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    The supplier has not published detailed specifications for this product yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.entries(groupedSpecs).map(([category, rows]) => (
                    <div key={category} className="p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 mb-2">{category}</p>
                      <div className="space-y-1.5">
                        {rows.map((row, idx) => (
                          <div key={idx} className="flex justify-between gap-4">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500">{row.specName}</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 text-right">{row.specValue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Dimensions-style raw rows are covered above; certifications are REAL */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="bg-slate-100 dark:bg-slate-900/70 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Certifications &amp; Compliance</h3>
              </div>
              <ProductCertifications productId={product.id} />
            </div>

            {/* Download raw record again for the road */}
            <div className="flex items-start gap-3 p-4 bg-slate-100 dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800">
              <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
                Everything on this page is served from the platform&apos;s live product record.
                Claims about quality or compliance appear here only when the supplier filed
                verifiable certification documents — never pre-filled, never invented.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
