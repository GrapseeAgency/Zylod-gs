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

function BuyerIllustration() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="48" fill="#FDE4E7" />
      <ellipse cx="50" cy="85" rx="34" ry="5" fill="#F1B7BF" opacity="0.4" />
      <rect x="12" y="78" width="76" height="5" rx="2.5" fill="#CBD5E1" />
      <path d="M28 80 C28 65 37 60 50 60 C63 60 72 65 72 80 Z" fill="#27272A" />
      <path d="M43 60 L50 71 L57 60 Z" fill="#FFFFFF" />
      <path d="M48 69 L50 78 L52 69 Z" fill="#E31C3D" />
      <rect x="46" y="52" width="8" height="10" rx="2" fill="#FBCFE8" />
      <circle cx="50" cy="42" r="14" fill="#FBCFE8" />
      <path
        d="M36 40 C36 28 42 22 50 22 C58 22 64 28 64 40 C64 42 62 43 59 40 C55 35 45 35 41 40 C38 43 36 42 36 40 Z"
        fill="#3F3F3F"
      />
      <rect x="41" y="38" width="7" height="5" rx="2" stroke="#27272A" strokeWidth="1.5" fill="none" />
      <rect x="52" y="38" width="7" height="5" rx="2" stroke="#27272A" strokeWidth="1.5" fill="none" />
      <line x1="48" y1="40" x2="52" y2="40" stroke="#27272A" strokeWidth="1.5" />
      <path d="M47 48 Q50 51 53 48" stroke="#9D174D" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <rect x="34" y="62" width="32" height="19" rx="2" fill="#525252" />
      <rect x="36" y="64" width="28" height="15" rx="1" fill="#F8FAFC" />
      <path d="M39 74 L44 69 L48 72 L54 66 L60 70" stroke="#E31C3D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M39 76 L59 76" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" />
      <path d="M30 81 L70 81 L67 83 L33 83 Z" fill="#94A3B8" />
      <circle cx="78" cy="28" r="10" fill="#E31C3D" />
      <path
        d="M74 28 L77 31 L83 25"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SupplierIllustration() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="48" fill="#FDE4E7" />
      <ellipse cx="50" cy="84" rx="36" ry="6" fill="#F1B7BF" opacity="0.45" />
      <rect x="20" y="40" width="60" height="42" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
      <rect x="27" y="52" width="18" height="30" rx="1.5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
      <rect x="30" y="56" width="12" height="14" rx="1" fill="#E2E8F0" />
      <circle cx="41" cy="68" r="1.5" fill="#E31C3D" />
      <rect x="49" y="52" width="25" height="20" rx="1.5" fill="#F0FDF4" stroke="#CBD5E1" strokeWidth="1.5" />
      <line x1="51" y1="63" x2="72" y2="63" stroke="#CBD5E1" strokeWidth="1" />
      <rect x="52" y="57" width="5" height="5.5" rx="0.5" fill="#E31C3D" />
      <rect x="59" y="56" width="5" height="6.5" rx="0.5" fill="#059669" />
      <rect x="66" y="58" width="4.5" height="4.5" rx="0.5" fill="#D97706" />
      <path d="M16 40 L84 40 L79 26 L21 26 Z" fill="#FFFFFF" />
      <path d="M21 26 L27 26 L23 40 L16 40 Z" fill="#E31C3D" />
      <path d="M33 26 L39 26 L37 40 L30 40 Z" fill="#E31C3D" />
      <path d="M45 26 L51 26 L51 40 L44 40 Z" fill="#E31C3D" />
      <path d="M57 26 L63 26 L65 40 L58 40 Z" fill="#E31C3D" />
      <path d="M69 26 L79 26 L84 40 L76 40 Z" fill="#E31C3D" />
      <path
        d="M16 40 Q20 44 24 40 Q28 44 32 40 Q36 44 40 40 Q44 44 48 40 Q52 44 56 40 Q60 44 64 40 Q68 44 72 40 Q76 44 80 40 Q82 43 84 40"
        fill="none"
        stroke="#E31C3D"
        strokeWidth="2.5"
      />
      <rect x="30" y="16" width="40" height="12" rx="3" fill="#E31C3D" />
      <text
        x="50"
        y="24.5"
        fontSize="6.5"
        fontWeight="800"
        fill="#FFFFFF"
        textAnchor="middle"
        fontFamily="sans-serif"
        letterSpacing="0.8"
      >
        ZYLOD
      </text>
      <rect x="74" y="70" width="14" height="12" rx="1.5" fill="#D97706" />
      <line x1="74" y1="74" x2="88" y2="74" stroke="#B45309" strokeWidth="1.2" />
      <line x1="81" y1="70" x2="81" y2="82" stroke="#B45309" strokeWidth="1.2" />
    </svg>
  )
}

function BuyerCtaCard() {
  const { navigate } = useNavigationStore()
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4">
      <div className="flex items-start justify-between gap-2.5 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold leading-snug text-gray-900 dark:text-gray-100 mb-1">
            Ready to start buying wholesale?
          </p>
          <p className="text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">
            Create your account and get access to thousands of suppliers and competitive prices.
          </p>
        </div>
        <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
          <BuyerIllustration />
        </div>
      </div>
      <button
        onClick={() => navigate('register-buyer')}
        className="w-full h-8.5 py-2 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:brightness-95 active:scale-[0.98] transition-all"
        style={{ background: RED }}
      >
        Register as Buyer <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </button>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
        Already have an account?{' '}
        <button onClick={() => navigate('login')} className="font-semibold hover:underline" style={{ color: RED }}>
          Login
        </button>
      </p>
    </div>
  )
}

function SupplierCtaCard() {
  const { navigate } = useNavigationStore()
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4">
      <div className="flex items-start gap-3 mb-3.5">
        <div className="h-20 w-20 shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
          <SupplierIllustration />
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
      <aside className="hidden lg:flex flex-col gap-3.5 xl:gap-4 w-full shrink-0" aria-label="Marketplace highlights">
        {cards}
      </aside>
    )
  }

  return (
    <section aria-label="Marketplace highlights" className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards}
    </section>
  )
}
