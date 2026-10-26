'use client'

import React from 'react'
import {
  ShieldCheck, CircleDollarSign, CreditCard, Truck, ArrowRight,
  ClipboardList, Heart, ShoppingCart, MessageSquare,
} from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { getGreeting } from '@/lib/greeting'

/* ════════════════════════════════════════════════════════════════════
   Right rail — 300px, hand-built to the owner's mockup (t211).

   variant="rail"   → fixed 300px column on xl+ screens (mockup layout).
   variant="inline" → same cards in a 2-column flow BELOW the featured
                      grid on <xl screens, so nothing from the design
                      is lost on smaller viewports.

   Guest: Buyer CTA (illustration flush top-right) → Supplier CTA
   (illustration left) → Why Choose Zylod? → Sustainability banner.
   Signed-in: the real quick-dashboard card replaces the two CTAs.
   ════════════════════════════════════════════════════════════════════ */

const RED = '#E31C3D'

const WHY_FEATURES = [
  { icon: ShieldCheck, title: 'Verified Suppliers', desc: 'Buy with confidence from trusted sellers' },
  { icon: CircleDollarSign, title: 'Competitive Prices', desc: 'Get the best wholesale rates' },
  { icon: CreditCard, title: 'Secure Transactions', desc: 'Multiple secure payment options' },
  { icon: Truck, title: 'Fast & Reliable Delivery', desc: 'Across Bangladesh' },
]

const DASHBOARD_ACTIONS = [
  { icon: ClipboardList, label: 'Orders', page: 'orders' as const },
  { icon: Heart, label: 'Wishlist', page: 'wishlist' as const },
  { icon: ShoppingCart, label: 'Cart', page: 'cart' as const },
  { icon: MessageSquare, label: 'Chat', page: 'chat-list' as const },
]

function BuyerCtaCard() {
  const { navigate } = useNavigationStore()
  return (
    <div className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
      {/* Illustration flush to the card's top-right corner (mockup) */}
      <div className="absolute top-0 right-0 h-[104px] w-[112px] rounded-tr-xl overflow-hidden pointer-events-none">
        <img
          src="/artwork/buyer-illustration.png"
          alt=""
          aria-hidden
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </div>
      <div className="p-4 pr-[122px]">
        <p className="text-[15px] font-bold leading-snug text-gray-900 dark:text-gray-100 mb-1.5">
          Ready to start buying wholesale?
        </p>
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 mb-3.5">
          Create your account and get access to thousands of suppliers and competitive prices.
        </p>
        <button
          onClick={() => navigate('register-buyer')}
          className="w-full h-9 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:brightness-95 active:scale-[0.98] transition-all"
          style={{ background: RED }}
        >
          Register as Buyer <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2.5">
          Already have an account?{' '}
          <button onClick={() => navigate('login')} className="font-semibold hover:underline" style={{ color: RED }}>
            Login
          </button>
        </p>
      </div>
    </div>
  )
}

function SupplierCtaCard() {
  const { navigate } = useNavigationStore()
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4">
      <div className="flex items-start gap-3 mb-3.5">
        <div className="h-20 w-20 shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
          <img
            src="/artwork/supplier-illustration.png"
            alt=""
            aria-hidden
            loading="lazy"
            className="h-full w-full object-contain"
            onError={(e) => {
              const t = e.target as HTMLImageElement
              t.style.display = 'none'
              t.parentElement!.innerHTML = '<span style="font-size:34px">🏪</span>'
            }}
          />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-snug text-gray-900 dark:text-gray-100 mb-1">
            Are you a supplier?
          </p>
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            Showcase your products to thousands of buyers and grow your business with Zylod.
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate('register-supplier')}
        className="w-full h-9 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:brightness-95 active:scale-[0.98] transition-all"
        style={{ background: RED }}
      >
        Register as Supplier <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

function WhyChooseCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4">
      <p className="text-[15px] font-bold mb-3.5" style={{ color: RED }}>
        Why Choose Zylod?
      </p>
      <ul className="space-y-3.5">
        {WHY_FEATURES.map((f) => {
          const Icon = f.icon
          return (
            <li key={f.title} className="flex items-start gap-2.5">
              <span className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#FDE4E7' }}>
                <Icon className="h-[18px] w-[18px]" style={{ color: RED }} aria-hidden />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[13px] font-bold leading-tight text-gray-900 dark:text-gray-100">{f.title}</p>
                <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">{f.desc}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SustainabilityCard() {
  const { navigate } = useNavigationStore()
  return (
    <div
      className="relative rounded-xl border border-gray-200/90 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #FDF2F3 0%, #FFFFFF 75%)' }}
    >
      {/* Leaf watermark */}
      <svg viewBox="0 0 100 100" className="absolute -right-4 -bottom-6 h-28 w-28 opacity-[0.08] pointer-events-none" aria-hidden>
        <path
          d="M50 88 C20 70 12 40 28 16 C52 24 76 44 66 78 C62 86 56 88 50 88 Z M50 88 C46 64 52 44 62 30"
          fill="none" stroke="#E31C3D" strokeWidth="3" strokeLinecap="round"
        />
      </svg>
      <div className="relative flex items-center gap-3">
        <svg viewBox="0 0 48 48" className="h-14 w-14 shrink-0" aria-hidden>
          <defs>
            <linearGradient id="zylod-leaf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="100%" stopColor="#E31C3D" />
            </linearGradient>
          </defs>
          <path d="M38 8 C20 10 9 20 9 33 c0 4 2 7 5 7 c13 0 24 -11 24 -27 c0 -2 0 -4 0 -5 Z" fill="url(#zylod-leaf)" />
          <path d="M14 38 C20 28 28 20 36 14" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
        </svg>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight text-gray-900 dark:text-gray-100">Sustainable Products</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">for a Better Tomorrow</p>
        </div>
      </div>
      <div className="relative flex justify-end mt-2">
        <button
          onClick={() => navigate('eco-friendly-products')}
          className="h-8 px-4 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 hover:brightness-95 active:scale-[0.98] transition-all"
          style={{ background: RED }}
        >
          Explore Now <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function DashboardQuickCard() {
  const { navigate } = useNavigationStore()
  const { user } = useAuthStore()
  const goDashboard = () => {
    const role = user?.userType
    if (role === 'admin') navigate('admin-dashboard')
    else if (role === 'supplier') navigate('supplier-dashboard')
    else navigate('buyer-dashboard')
  }
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: RED }}>
            {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{getGreeting()},</p>
            <p className="text-xs font-semibold" style={{ color: RED }}>{user?.fullName || 'User'}!</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {DASHBOARD_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.page)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: '#FDE4E7' }}>
                  <Icon className="h-4 w-4" style={{ color: RED }} aria-hidden />
                </span>
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{action.label}</span>
              </button>
            )
          })}
        </div>
        <button
          onClick={goDashboard}
          className="w-full h-9 rounded-lg text-white text-xs font-semibold hover:brightness-95 active:scale-[0.98] transition-all"
          style={{ background: RED }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}

export function RightRail({ variant = 'rail' }: { variant?: 'rail' | 'inline' }) {
  const { isAuthenticated, user } = useAuthStore()

  const cards = (
    <>
      {isAuthenticated && user ? (
        <DashboardQuickCard />
      ) : (
        <>
          <BuyerCtaCard />
          <SupplierCtaCard />
        </>
      )}
      <WhyChooseCard />
      <SustainabilityCard />
    </>
  )

  if (variant === 'rail') {
    return (
      <aside className="hidden 2xl:flex flex-col gap-4 w-[300px] shrink-0" aria-label="Marketplace highlights">
        {cards}
      </aside>
    )
  }

  return (
    <section aria-label="Marketplace highlights" className="2xl:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards}
    </section>
  )
}
