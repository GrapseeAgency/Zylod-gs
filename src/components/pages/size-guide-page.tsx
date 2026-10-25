'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { X, Shirt, Info } from 'lucide-react'

interface SizeSpec {
  size: string
  chestIn: string
  chestCm: string
  lengthIn: string
  lengthCm: string
  sleeveIn: string
  sleeveCm: string
}

/**
 * HONEST general garment size chart.
 *
 * Previously this page lied: it claimed "Recommended Size: Large" based on a
 * fabricated previous purchase ("Industrial Work Shirt - Heavyweight") — no
 * such purchase was ever read. The chart itself is a real, reusable garment
 * sizing reference, so it stays, but the fake recommendation is gone.
 *
 * When pageParams.productId is supplied, the product name is loaded from
 * GET /api/products/[id] so the chart is honestly scoped to that product's
 * category; without a productId the page is labeled as a general reference.
 */

const GARMENT_SIZES: SizeSpec[] = [
  { size: 'S',  chestIn: '38" - 40"', chestCm: '96 - 101 cm',  lengthIn: '28"', lengthCm: '71 cm', sleeveIn: '33"', sleeveCm: '84 cm' },
  { size: 'M',  chestIn: '40" - 42"', chestCm: '101 - 106 cm', lengthIn: '29"', lengthCm: '74 cm', sleeveIn: '34"', sleeveCm: '86 cm' },
  { size: 'L',  chestIn: '42" - 44"', chestCm: '106 - 112 cm', lengthIn: '30"', lengthCm: '76 cm', sleeveIn: '35"', sleeveCm: '89 cm' },
  { size: 'XL', chestIn: '44" - 46"', chestCm: '112 - 117 cm', lengthIn: '31"', lengthCm: '79 cm', sleeveIn: '36"', sleeveCm: '91 cm' },
]

export function SizeGuidePage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { goBack } = useNavigationStore()
  const pageParams = _pageParams || {}
  const productId = pageParams.productId || pageParams.id || ''
  const [unit, setUnit] = useState<'inches' | 'cm'>('inches')
  const [productName, setProductName] = useState<string | null>(null)
  const [productCategory, setProductCategory] = useState<string | null>(null)

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    fetch(`/api/products/${encodeURIComponent(productId)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        const p = d?.data ?? d?.product ?? null
        if (p?.name) setProductName(p.name)
        if (p?.category?.name) setProductCategory(p.category.name)
        else if (p?.categoryId) setProductCategory(null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [productId])

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3.5 shadow-xs">
        <div className="relative flex items-center justify-center">
          <button
            onClick={goBack}
            className="absolute left-0 p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100"
            title="Close"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-bold text-primary">Size Guide</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100 px-6 pt-6">Size Guide</h1>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Honest scope banner */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-rose-100 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shirt className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {productName ? `Sizing for ${productName}` : 'General garment size chart'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
              {productName
                ? `Reference measurements for this product's category${productCategory ? ` (${productCategory})` : ''}. For exact fit, contact the supplier before placing a bulk order.`
                : 'Reference measurements for woven garments (shirts, kameez, workwear). For knitwear, denim, or outerwear, ask the supplier for their category-specific chart.'}
            </p>
          </div>
        </div>

        {/* Visual garment diagram */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xs relative flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[280px] aspect-[4/3] flex items-center justify-center">
            <svg viewBox="0 0 300 240" className="w-full h-full text-slate-300 stroke-current fill-none stroke-[1.5]" aria-hidden="true">
              <path d="M 110 50 L 150 70 L 190 50 L 260 100 L 235 130 L 195 105 L 195 200 L 105 200 L 105 105 L 65 130 L 40 100 Z" className="fill-slate-50/50" />
              <path d="M 110 50 Q 150 80 190 50" />
              <path d="M 150 70 L 150 200" strokeDasharray="3 3" className="stroke-rose-400" />
              <path d="M 105 105 L 195 105" strokeDasharray="3 3" className="stroke-rose-400" />
              <rect x="160" y="105" width="22" height="26" rx="2" />
            </svg>
            <div className="absolute top-[42%] left-[40%] -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">A</div>
            <div className="absolute top-[42%] right-[40%] translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">A</div>
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">B</div>
            <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">B</div>
            <div className="absolute top-[25%] left-[24%] -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">C</div>
          </div>
        </div>

        {/* Units switcher */}
        <div className="flex justify-end">
          <div className="inline-flex bg-slate-200/80 p-1 rounded-2xl" role="group" aria-label="Measurement unit">
            <button
              onClick={() => setUnit('inches')}
              aria-pressed={unit === 'inches'}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                unit === 'inches' ? 'bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              Inches
            </button>
            <button
              onClick={() => setUnit('cm')}
              aria-pressed={unit === 'cm'}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                unit === 'cm' ? 'bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              CM
            </button>
          </div>
        </div>

        {/* Size table */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[320px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 dark:text-slate-500 font-bold text-[11px]">
                  <th scope="col" className="p-3.5">Size</th>
                  <th scope="col" className="p-3.5">A. Chest</th>
                  <th scope="col" className="p-3.5">B. Length</th>
                  <th scope="col" className="p-3.5">C. Sleeve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {GARMENT_SIZES.map((row) => (
                  <tr key={row.size} className="text-slate-700 dark:text-slate-300">
                    <td className="p-3.5"><span>{row.size}</span></td>
                    <td className="p-3.5">{unit === 'inches' ? row.chestIn : row.chestCm}</td>
                    <td className="p-3.5">{unit === 'inches' ? row.lengthIn : row.lengthCm}</td>
                    <td className="p-3.5">{unit === 'inches' ? row.sleeveIn : row.sleeveCm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* How to measure */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">How to measure</h3>
          <div className="space-y-3">
            {[
              { k: 'A', label: 'Chest', text: 'Measure around the fullest part of your chest, keeping the measuring tape horizontal.' },
              { k: 'B', label: 'Length', text: 'Measure from the high point of your shoulder straight down to the hem.' },
              { k: 'C', label: 'Sleeve', text: 'Measure from the center back of your neck, across the shoulder, and down to the wrist.' },
            ].map(m => (
              <div key={m.k} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{m.k}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
                  <strong className="text-slate-800 dark:text-slate-200">{m.label}:</strong> {m.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Honest disclaimer */}
        <div className="bg-slate-100 dark:bg-slate-900/60 rounded-3xl p-4 border border-slate-200 dark:border-slate-800/80 flex gap-3 items-start">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
            These are reference body measurements, not garment dimensions. Suppliers may cut to
            their own blocks; always request a sample for bulk orders where fit is critical.
          </p>
        </div>
      </main>
    </div>
  )
}

export default SizeGuidePage
