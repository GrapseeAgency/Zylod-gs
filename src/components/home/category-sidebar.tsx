'use client'

import React from 'react'
import {
  LayoutGrid, ChevronRight, Layers, Leaf, Smartphone, Package,
  Home, Users, Headphones, ArrowRight, Shirt, Sparkles, Lightbulb,
} from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'

/* ─── t210-r2: left rail 1:1 with the mockup ───
   Categories card (red grid chip + 8 colored rows + chevrons),
   pink "Become a Supplier" card, "Need Help?" card with outlined button. */

const RED = '#E31C3D'

/* The 8 mockup categories — all exist in the real DB (verified via /api/categories).
   Icon + pastel chip color per mockup. */
const CATEGORIES = [
  { slug: 'textiles-fabrics', label: 'Textiles & Fabrics', icon: Layers, chip: '#F3E8FF', color: '#9333EA' },
  { slug: 'agriculture-food', label: 'Agriculture & Food', icon: Leaf, chip: '#DCFCE7', color: '#16A34A' },
  { slug: 'electronics', label: 'Electronics & Accessories', icon: Smartphone, chip: '#FFEDD5', color: '#EA580C' },
  { slug: 'packaging', label: 'Packaging & Jute', icon: Package, chip: '#FEF3C7', color: '#D97706' },
  { slug: 'home-garden', label: 'Home & Crafts', icon: Home, chip: '#FEE2E2', color: '#DC2626' },
  { slug: 'garments', label: 'Garments & Apparel', icon: Shirt, chip: '#DBEAFE', color: '#2563EB' },
  { slug: 'leather', label: 'Leather Goods', icon: Sparkles, chip: '#FCE7F3', color: '#DB2777' },
  { slug: 'led-lighting', label: 'LED & Lighting', icon: Lightbulb, chip: '#FEF9C3', color: '#CA8A04' },
]

export function CategorySidebar() {
  const { navigate } = useNavigationStore()

  return (
    <aside className="hidden lg:block w-[240px] shrink-0 space-y-4">
      {/* ═══════════ Categories card ═══════════ */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-2.5">
        {/* Header */}
        <button
          onClick={() => navigate('category-navigation')}
          className="w-full flex items-center gap-2.5 px-2 py-2.5 mb-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
            <LayoutGrid className="h-4 w-4" style={{ color: RED }} />
          </span>
          <span className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Categories</span>
        </button>

        {/* Rows */}
        <div className="space-y-0.5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <button
                key={cat.slug}
                onClick={() => navigate('category-products', { categoryId: cat.slug })}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 group transition-colors"
              >
                <span
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                  style={{ background: cat.chip }}
                >
                  <Icon className="h-[18px] w-[18px]" style={{ color: cat.color }} />
                </span>
                <span className="text-[12.5px] font-medium text-gray-700 dark:text-gray-300 flex-1 text-left leading-tight">
                  {cat.label}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══════════ Become a Supplier (pink card) ═══════════ */}
      <div className="rounded-xl p-4" style={{ background: '#FFF1F2' }}>
        <Users className="h-6 w-6 mb-2" style={{ color: RED }} />
        <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100 mb-1">Become a Supplier</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
          Reach thousands of buyers and grow your business.
        </p>
        <button
          onClick={() => navigate('register-supplier')}
          className="w-full h-9 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all"
          style={{ background: RED }}
        >
          Register Now <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ═══════════ Need Help? ═══════════ */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4">
        <Headphones className="h-6 w-6 mb-2" style={{ color: RED }} />
        <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100 mb-1">Need Help?</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
          Our support team is here for you 24/7.
        </p>
        <button
          onClick={() => navigate('contact-us')}
          className="w-full h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-[0.98] transition-all"
          style={{ borderColor: RED, color: RED }}
        >
          Contact Support <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  )
}
