'use client'

import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Tag, TrendingDown, Package, Layers,
  ChevronRight, CheckCircle2, Percent
} from 'lucide-react'

export function BulkPricingGuidePage() {
  const { navigate, goBack } = useNavigationStore()

  const tiers = [
    {
      label: 'Starter Bulk',
      units: '50–199 units',
      discount: '5–8%',
      badge: 'Tier 1',
      color: 'from-slate-600 to-slate-700',
      desc: 'Applies automatically on eligible SKUs when cart MOQ meets minimum threshold.',
    },
    {
      label: 'Standard Wholesale',
      units: '200–499 units',
      discount: '10–15%',
      badge: 'Tier 2',
      color: 'from-blue-600 to-blue-700',
      desc: 'Most popular tier for medium retailers. Price applied at checkout instantly.',
    },
    {
      label: 'Large Volume',
      units: '500–999 units',
      discount: '16–22%',
      badge: 'Tier 3',
      color: 'from-red-600 to-rose-600',
      desc: 'Negotiated supplier pricing. Contact supplier to lock in this discount rate.',
    },
    {
      label: 'Factory Direct',
      units: '1,000+ units',
      discount: '23–35%+',
      badge: 'Tier 4',
      color: 'from-slate-900 to-slate-800',
      desc: 'Ex-factory pricing at mill rate. Requires advance payment and 7–14 day production.',
    },
  ]

  const rules = [
    'Bulk discounts apply per individual SKU, not across multiple product types.',
    'MOQ is set by the supplier and cannot be negotiated below listed minimums.',
    'Volume tiers are calculated at checkout based on confirmed cart quantity.',
    'Discounts cannot be combined with clearance or promotional coupon codes.',
    'Tier 3 and Tier 4 rates require direct supplier confirmation via in-app messaging.',
    'Price changes during flash sales override standard bulk tier rates for the duration.',
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-bold text-gray-900 text-base">Volume Discount &amp; Bulk Pricing</span>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-3xl mx-auto w-full pb-24 md:py-8 md:space-y-8 md:max-w-4xl lg:max-w-5xl md:pb-8">
        {/* Hero */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-3xl p-6 shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-200 uppercase tracking-wide">
            <Percent className="w-4 h-4" />
            Official Zylod Volume Pricing
          </div>
          <h1 className="text-lg sm:text-xl md:text-3xl font-bold">Bulk Discount Tier System</h1>
          <p className="text-xs text-red-100 leading-relaxed">
            Buy more, save more. Zylod's 4-tier volume pricing system gives Bangladesh wholesale buyers transparent, automatic discounts—no coupon codes needed.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
            Discount Tiers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {tiers.map((tier, idx) => (
              <motion.div
                key={tier.badge}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-md bg-gradient-to-r ${tier.color}`}>
                    {tier.badge}
                  </span>
                  <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                    {tier.discount} OFF
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{tier.label}</p>
                  <p className="text-[11px] text-gray-400">{tier.units}</p>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{tier.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <Layers className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-bold text-gray-900">Bulk Pricing Rules</h2>
          </div>
          <ul className="space-y-2.5 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-2.5 md:space-y-0">
            {rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* MOQ Info Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <Tag className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <p className="font-bold mb-1">What is MOQ?</p>
            <p>
              Minimum Order Quantity (MOQ) is the smallest number of units a supplier will sell per order. It is set by each manufacturer individually. Zylod enforces MOQ compliance during checkout — your cart must meet each supplier's MOQ before the order can be placed.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('category-browser')}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition"
          >
            Browse Categories →
          </button>
          <button
            onClick={() => navigate('search-home')}
            className="px-6 py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-700 rounded-xl text-xs font-bold shadow-sm transition"
          >
            Search Wholesale Products →
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulkPricingGuidePage
