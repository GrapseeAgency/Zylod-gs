'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Truck, MapPin, CheckCircle2, Clock } from 'lucide-react'

export function DomesticShippingPage() {
  const { navigate, goBack } = useNavigationStore()

  const tiers = [
    {
      title: 'Dhaka Metropolitan Express',
      time: '24–48 Hours',
      couriers: 'Pathao, Steadfast, Dedicated Van Fleets',
      rates: '৳60–100 / parcel (< 5kg) · Discounted bulk freight slabs for 50kg+',
    },
    {
      title: 'District Headquarters (Chittagong, Sylhet, Rajshahi)',
      time: '2–3 Business Days',
      couriers: 'Steadfast Courier, RedX, eCourier Hubs',
      rates: '৳100–160 / parcel (< 5kg) · LTL pallet quotes available',
    },
    {
      title: 'Rural Upazilas & Outer Unions (64 Districts)',
      time: '3–6 Business Days',
      couriers: 'Steadfast Union Hubs, Paperfly Rural Hubs',
      rates: '৳150–250 / parcel (< 5kg) · Doorstep covered van dispatch',
    },
    {
      title: 'Dedicated Mill Full Truck Load (FTL)',
      time: 'Direct Factory Dispatch',
      couriers: '3 Ton / 5 Ton / 10 Ton Covered Trucks',
      rates: 'Flat chartered freight quoted on checkout by weight & distance',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Domestic Wholesale Logistics</h1>
          <p className="text-xs text-gray-400">Coverage Across All 64 Districts in Bangladesh</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 lg:max-w-4xl pb-24 md:pb-8">
        <div className="hidden md:block">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Domestic Wholesale Logistics</h1>
          <p className="text-sm text-gray-400 mt-1">Coverage Across All 64 Districts in Bangladesh</p>
        </div>

        <div className="bg-indigo-600 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            <h2 className="font-bold text-sm">Nationwide Freight Coordination</h2>
          </div>
          <p className="text-xs text-indigo-100 leading-relaxed">
            Every shipment on Zylod is tracked via API telemetry with carrier integration and SMS delivery milestone updates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {tiers.map(t => (
            <div key={t.title} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-bold text-gray-900">{t.title}</h3>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
                  {t.time}
                </Badge>
              </div>
              <p className="text-[11px] text-gray-500"><strong>Partners:</strong> {t.couriers}</p>
              <div className="p-2.5 bg-slate-50 rounded-2xl">
                <p className="text-xs text-indigo-900 font-semibold">{t.rates}</p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('shipping-calculator')} className="w-full md:w-auto md:px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold py-3">
          Calculate Shipping Rate
        </Button>
      </div>
    </div>
  )
}

export default DomesticShippingPage
