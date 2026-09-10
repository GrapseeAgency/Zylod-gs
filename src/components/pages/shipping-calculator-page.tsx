'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, MoreVertical, MapPin, Building2, Calculator,
  Truck, Warehouse, ShieldCheck, Check, Sparkles
} from 'lucide-react'

export function ShippingCalculatorPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [origin, setOrigin] = useState('Chittagong Port (BDCGP)')
  const [destination, setDestination] = useState('Dhaka Tejgaon Hub (BDDAC)')
  const [weight, setWeight] = useState('450')
  const [length, setLength] = useState('120')
  const [width, setWidth] = useState('80')
  const [height, setHeight] = useState('100')
  const [hasHazmat, setHasHazmat] = useState(false)
  const [includeInsurance, setIncludeInsurance] = useState(true)
  const [calculated, setCalculated] = useState(true)

  // Real-time calculation logic
  const numericWeight = parseFloat(weight) || 0
  const volumetricWeight = ((parseFloat(length) || 0) * (parseFloat(width) || 0) * (parseFloat(height) || 0)) / 5000
  const chargeableWeight = Math.max(numericWeight, volumetricWeight)
  const baseFreightRate = 1.25 // $ per kg
  const freightCost = chargeableWeight * baseFreightRate
  const hazmatFee = hasHazmat ? 150 : 0
  const insuranceFee = includeInsurance ? Math.max(50, freightCost * 0.03) : 0
  const totalCost = freightCost + hazmatFee + insuranceFee

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Logistics Suite</span>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Logistics Suite</h1>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Title */}
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Freight Calculator
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Estimate multimodal shipping costs, customs, and local logistics.
          </p>
        </div>

        {/* Shipment Details Form Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Shipment Details
          </h2>

          {/* Origin */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Origin Port / Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Shenzhen (CNSZX)"
                className="h-11 pl-10 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Destination Warehouse
            </label>
            <div className="relative">
              <Warehouse className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Los Angeles (USLAX)"
                className="h-11 pl-10 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Total Chargeable Weight
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.00"
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-bold font-mono"
              />
              <div className="h-11 px-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center shrink-0">
                KG
              </div>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Dimensions (L × W × H)
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="L"
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs text-center font-bold"
              />
              <span className="text-slate-400 font-bold">×</span>
              <Input
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="W"
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs text-center font-bold"
              />
              <span className="text-slate-400 font-bold">×</span>
              <Input
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="H"
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs text-center font-bold"
              />
              <div className="h-11 px-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center shrink-0">
                CM
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2 pt-1">
            <label className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={hasHazmat}
                onCheckedChange={(v) => setHasHazmat(!!v)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-xs font-semibold text-slate-800">
                Contains Hazardous Materials
              </span>
            </label>

            <label className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={includeInsurance}
                onCheckedChange={(v) => setIncludeInsurance(!!v)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-xs font-semibold text-slate-800">
                Include Cargo Insurance
              </span>
            </label>
          </div>
        </div>

        {/* Calculation Result Card */}
        {calculated && (
          <div className="bg-white rounded-3xl p-5 border-2 border-rose-100 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Estimated Freight Cost
              </span>
              <span className="text-2xl font-black text-primary">
                {formatPrice(totalCost)}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 divide-y divide-slate-50">
              <div className="flex justify-between py-1">
                <span>Chargeable Weight</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {chargeableWeight.toFixed(1)} kg
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Base Multimodal Freight</span>
                <span className="font-semibold text-slate-900">{formatPrice(freightCost)}</span>
              </div>
              {hasHazmat && (
                <div className="flex justify-between py-1 text-amber-700">
                  <span>Hazmat Surcharge</span>
                  <span className="font-semibold">{formatPrice(hazmatFee)}</span>
                </div>
              )}
              {includeInsurance && (
                <div className="flex justify-between py-1 text-emerald-700">
                  <span>Comprehensive Cargo Insurance</span>
                  <span className="font-semibold">{formatPrice(insuranceFee)}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span>Estimated Transit Time</span>
                <span className="font-bold text-slate-900">2-3 Business Days</span>
              </div>
            </div>

            <Button
              onClick={() => navigate('shipping-tracker')}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
            >
              Book Freight with this Estimate
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}