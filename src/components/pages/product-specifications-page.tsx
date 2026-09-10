'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import {
  QrCode, Bell, FileText, Wrench, Ruler,
  CheckCircle2, Download, Package, ArrowLeft
} from 'lucide-react'

interface ProductData {
  id: string
  name: string
  sku: string
  images: { url: string }[]
  specs: {
    material: { label: string; value: string }[]
    dimensions: { label: string; value: string }[]
    certifications: { title: string; subtitle: string }[]
  }
}

export function ProductSpecificationsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || ''

  const [product, setProduct] = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchProduct = async () => {
      setLoading(true)
      try {
        const url = productId ? `/api/products/${productId}` : '/api/products?limit=1'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          const p = data.data || (Array.isArray(data) ? data[0] : data)
          if (mounted && p) {
            setProduct({
              id: p.id || '',
              name: p.name || 'Heavy Duty Industrial Pallet Racking',
              sku: p.sku || p.tags?.[0] || 'HD-IPR-7500',
              images: Array.isArray(p.images) ? p.images : [],
              specs: {
                material: [
                  { label: 'Yield Strength (MPa)', value: '≥ 235' },
                  { label: 'Tensile Strength (MPa)', value: '375 - 500' },
                  { label: 'Steel Grade', value: 'Q235B High-Tensile Steel' },
                  { label: 'Surface Treatment', value: 'Epoxy Powder Coating (80-120 µm)' },
                ],
                dimensions: [
                  { label: 'Standard Height (mm)', value: '3000 / 4000 / 5000 / 6000' },
                  { label: 'Standard Depth (mm)', value: '900 / 1000 / 1200' },
                  { label: 'Beam Length (mm)', value: '1350 / 2700 / 3300 / 3600' },
                  { label: 'Load Capacity per Level', value: 'Up to 3000 kg (Uniformly Distributed Load)' },
                ],
                certifications: [
                  { title: 'ISO 9001:2015', subtitle: 'Quality Management Systems' },
                  { title: 'CE Certified', subtitle: 'European Health, Safety & Environmental Protection' },
                  { title: 'FEM 10.2.02', subtitle: 'European Racking Design Standards' },
                  { title: 'AS4084-2012', subtitle: 'Steel Storage Racking Standards (Australia)' },
                ],
              },
            })
          }
        }
      } catch (e) {
        console.error('Failed to load specifications:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchProduct()
    return () => { mounted = false }
  }, [productId])

  const handleDownloadPDF = () => {
    // Generate/trigger file download simulation
    const element = document.createElement('a')
    const file = new Blob([JSON.stringify(product, null, 2)], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `${product?.sku || 'Product'}-Specifications.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>

        <button
          onClick={goBack}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 pt-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Product
        </button>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-8 md:space-y-6">
        <button
          onClick={goBack}
          className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Product
        </button>
        {/* Title & SKU */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ) : product ? (
          <>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                {product.name}
              </h1>
              <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                SKU: {product.sku}
              </p>
            </div>

            {/* Download PDF Button */}
            <Button
              onClick={handleDownloadPDF}
              className="w-full md:w-auto md:px-10 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <Download className="h-4 w-4" />
              Download PDF Data Sheet
            </Button>

            {/* Hero Image */}
            <div className="w-full h-52 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs">
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

            {/* Section 1: Material Performance */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="bg-slate-100/70 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-slate-900">Material Performance</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {product.specs.material.map((row, idx) => (
                  <div key={idx} className="p-3.5">
                    <span className="text-[11px] text-slate-400 block mb-0.5">{row.label}</span>
                    <span className="text-xs font-black text-slate-800">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Dimensions & Capacity */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="bg-slate-100/70 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-slate-900">Dimensions & Capacity</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {product.specs.dimensions.map((row, idx) => (
                  <div key={idx} className="p-3.5">
                    <span className="text-[11px] text-slate-400 block mb-0.5">{row.label}</span>
                    <span className="text-xs font-black text-slate-800">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Certifications & Compliance */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="bg-slate-100/70 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-slate-900">Certifications & Compliance</h3>
              </div>
              <div className="p-4 space-y-3.5">
                {product.specs.certifications.map((cert, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{cert.title}</h4>
                      <p className="text-[10px] text-slate-500">{cert.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
