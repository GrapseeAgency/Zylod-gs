'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { X, Sparkles, Shirt } from 'lucide-react'

interface SizeSpec {
  size: string
  chestIn: string
  chestCm: string
  lengthIn: string
  lengthCm: string
  sleeveIn: string
  sleeveCm: string
  recommended?: boolean
}

export function SizeGuidePage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { goBack } = useNavigationStore()
  const [unit, setUnit] = useState<'inches' | 'cm'>('inches')

  const sizeData: SizeSpec[] = [
    { size: 'S', chestIn: '38" - 40"', chestCm: '96 - 101 cm', lengthIn: '28"', lengthCm: '71 cm', sleeveIn: '33"', sleeveCm: '84 cm' },
    { size: 'M', chestIn: '40" - 42"', chestCm: '101 - 106 cm', lengthIn: '29"', lengthCm: '74 cm', sleeveIn: '34"', sleeveCm: '86 cm' },
    { size: 'L', chestIn: '42" - 44"', chestCm: '106 - 112 cm', lengthIn: '30"', lengthCm: '76 cm', sleeveIn: '35"', sleeveCm: '89 cm', recommended: true },
    { size: 'XL', chestIn: '44" - 46"', chestCm: '112 - 117 cm', lengthIn: '31"', lengthCm: '79 cm', sleeveIn: '36"', sleeveCm: '91 cm' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3.5 shadow-xs">
        <div className="relative flex items-center justify-center">
          <button
            onClick={goBack}
            className="absolute left-0 p-1 text-slate-700 hover:text-slate-900"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-bold text-primary">Size Guide</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Size Guide</h1>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Recommended Size Box */}
        <div className="bg-white rounded-3xl p-4 border border-rose-100 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900">
              Recommended Size: Large
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Based on your previous purchase of &lsquo;Industrial Work Shirt - Heavyweight&rsquo;, we recommend size Large for the best fit.
            </p>
          </div>
        </div>

        {/* Visual Garment Diagram Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs relative flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[280px] aspect-[4/3] flex items-center justify-center">
            {/* SVG Garment Illustration with Measurement Markers */}
            <svg viewBox="0 0 300 240" className="w-full h-full text-slate-300 stroke-current fill-none stroke-[1.5]">
              {/* Shirt Outline */}
              <path d="M 110 50 L 150 70 L 190 50 L 260 100 L 235 130 L 195 105 L 195 200 L 105 200 L 105 105 L 65 130 L 40 100 Z" className="fill-slate-50/50" />
              {/* Collar */}
              <path d="M 110 50 Q 150 80 190 50" />
              <path d="M 150 70 L 150 200" strokeDasharray="3 3" className="stroke-rose-400" />
              {/* Chest Line */}
              <path d="M 105 105 L 195 105" strokeDasharray="3 3" className="stroke-rose-400" />
              {/* Pocket */}
              <rect x="160" y="105" width="22" height="26" rx="2" />
            </svg>

            {/* Marker A: Chest */}
            <div className="absolute top-[42%] left-[40%] -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">
              A
            </div>
            <div className="absolute top-[42%] right-[40%] translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">
              A
            </div>

            {/* Marker B: Length */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">
              B
            </div>
            <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">
              B
            </div>

            {/* Marker C: Sleeve */}
            <div className="absolute top-[25%] left-[24%] -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-md">
              C
            </div>
          </div>
        </div>

        {/* Units Switcher */}
        <div className="flex justify-end">
          <div className="inline-flex bg-slate-200/80 p-1 rounded-2xl">
            <button
              onClick={() => setUnit('inches')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                unit === 'inches' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Inches
            </button>
            <button
              onClick={() => setUnit('cm')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                unit === 'cm' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              CM
            </button>
          </div>
        </div>

        {/* Size Table */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold text-[11px]">
                <th className="p-3.5">Size</th>
                <th className="p-3.5">A. Chest</th>
                <th className="p-3.5">B. Length</th>
                <th className="p-3.5">C. Sleeve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sizeData.map((row) => {
                const isRec = row.recommended
                return (
                  <tr
                    key={row.size}
                    className={isRec ? 'bg-rose-50/60 font-bold text-primary' : 'text-slate-700'}
                  >
                    <td className="p-3.5 flex items-center gap-1">
                      <span>{row.size}</span>
                      {isRec && <Sparkles className="h-3 w-3 fill-primary text-primary" />}
                    </td>
                    <td className="p-3.5">{unit === 'inches' ? row.chestIn : row.chestCm}</td>
                    <td className="p-3.5">{unit === 'inches' ? row.lengthIn : row.lengthCm}</td>
                    <td className="p-3.5">{unit === 'inches' ? row.sleeveIn : row.sleeveCm}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* How to Measure Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            How to Measure
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                A
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-800">Chest:</strong> Measure around the fullest part of your chest, keeping the measuring tape horizontal.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                B
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-800">Length:</strong> Measure from the high point of your shoulder straight down to the hem.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                C
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-800">Sleeve:</strong> Measure from the center back of your neck, across the shoulder, and down to the wrist.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default SizeGuidePage
