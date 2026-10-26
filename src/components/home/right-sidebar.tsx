'use client'

import React from 'react'
import { ShieldCheck, CircleDollarSign, CreditCard, Truck, ArrowRight } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { getGreeting } from '@/lib/greeting'
import { Button } from '@/components/ui/button'
import {
  ClipboardList, Heart, ShoppingCart, MessageSquare,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'

/* ─── t210-r2: right rail 1:1 with the mockup ───
   Buyer CTA (illustration top-right) → Supplier CTA (illustration left) →
   "Why Choose Zylod?" (4 rows, pink circles) → Sustainability banner. */

const RED = '#E31C3D'
const WHY_FEATURES = [
  { icon: ShieldCheck, title: 'Verified Suppliers', desc: 'Buy with confidence from trusted sellers' },
  { icon: CircleDollarSign, title: 'Competitive Prices', desc: 'Get the best wholesale rates' },
  { icon: CreditCard, title: 'Secure Transactions', desc: 'Multiple secure payment options' },
  { icon: Truck, title: 'Fast & Reliable Delivery', desc: 'Across Bangladesh' },
]

export function RightSidebar() {
  const { setCurrentPage } = useNavigationStore()
  const { isAuthenticated, user } = useAuthStore()

  return (
    <aside className="hidden xl:block w-[300px] shrink-0 space-y-4">

      {/* ═══════════ Logged-in: keep the real dashboard card ═══════════ */}
      {isAuthenticated && user ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: RED }}>
                {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{getGreeting()},</p>
                <p className="text-xs font-semibold" style={{ color: RED }}>{user.fullName || 'User'}!</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { icon: ClipboardList, label: 'Orders', page: 'orders' as const },
                { icon: Heart, label: 'Wishlist', page: 'wishlist' as const },
                { icon: ShoppingCart, label: 'Cart', page: 'cart' as const },
                { icon: MessageSquare, label: 'Chat', page: 'chat-list' as const },
              ].map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    onClick={() => setCurrentPage(action.page)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${RED}12` }}>
                      <Icon className="h-4 w-4" style={{ color: RED }} />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{action.label}</span>
                  </button>
                )
              })}
            </div>
            <Separator className="mb-3" />
            <Button
              className="w-full text-xs font-semibold"
              style={{ background: RED, color: '#fff' }}
              onClick={() => {
                const role = user?.userType
                if (role === 'admin') setCurrentPage('admin-dashboard')
                else if (role === 'supplier') setCurrentPage('supplier-dashboard')
                else setCurrentPage('buyer-dashboard')
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* ═══════════ Card 1: Buyer CTA — illustration TOP-RIGHT (mockup) ═══════════ */}
          <div
            className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden"
          >
            <div className="p-4 pr-24">
              <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1.5">
                Ready to start buying wholesale?
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3.5">
                Create your account and get access to thousands of suppliers and competitive prices.
              </p>
              <button
                onClick={() => setCurrentPage('register-buyer')}
                className="w-full h-9 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all"
                style={{ background: RED }}
              >
                Register as Buyer <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2.5">
                Already have an account?{' '}
                <button onClick={() => setCurrentPage('login')} className="font-semibold hover:underline" style={{ color: RED }}>
                  Login
                </button>
              </p>
            </div>
            {/* Illustration top-right, blending */}
            <div className="absolute top-0 right-0 h-24 w-24 pointer-events-none">
              <img
                src="/artwork/buyer-illustration.png"
                alt=""
                className="h-full w-full object-contain object-top"
                loading="lazy"
                onError={(e) => {
                  const t = e.target as HTMLImageElement
                  t.style.display = 'none'
                  t.insertAdjacentHTML('afterend', '')
                }}
              />
            </div>
          </div>

          {/* ═══════════ Card 2: Supplier CTA — illustration LEFT (mockup) ═══════════ */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-20 w-20 shrink-0 flex items-center justify-center">
                  <img
                    src="/artwork/supplier-illustration.png"
                    alt=""
                    className="h-full w-full object-contain"
                    loading="lazy"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement
                      t.style.display = 'none'
                      t.parentElement!.innerHTML = '<span style="font-size:32px">🏪</span>'
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1">
                    Are you a supplier?
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Showcase your products to thousands of buyers and grow your business with Zylod.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCurrentPage('register-supplier')}
                className="w-full h-9 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all"
                style={{ background: RED }}
              >
                Register as Supplier <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ Card 3: Why Choose Zylod? ═══════════ */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4">
        <p className="text-[15px] font-bold mb-3" style={{ color: RED }}>Why Choose Zylod?</p>
        <div className="space-y-3">
          {WHY_FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="flex items-start gap-2.5">
                <span className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#FEE2E2' }}>
                  <Icon className="h-[18px] w-[18px]" style={{ color: RED }} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-tight">{f.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{f.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════ Card 4: Sustainability banner — crisp inline leaf + watermark ═══════════ */}
      <div
        className="rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #FDF2F3 0%, #FFFFFF 75%)' }}
      >
        {/* Decorative leaf watermark (mockup) */}
        <svg
          viewBox="0 0 100 100"
          className="absolute -right-4 -bottom-6 h-28 w-28 opacity-[0.08] pointer-events-none"
          aria-hidden
        >
          <path
            d="M50 88 C20 70 12 40 28 16 C52 24 76 44 66 78 C62 86 56 88 50 88 Z M50 88 C46 64 52 44 62 30"
            fill="none" stroke="#E31C3D" strokeWidth="3" strokeLinecap="round"
          />
        </svg>
        <div className="flex items-center gap-3 relative">
          {/* Inline leaf artwork — always crisp, no load failure */}
          <svg viewBox="0 0 48 48" className="h-14 w-14 shrink-0" aria-hidden>
            <defs>
              <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F87171" />
                <stop offset="100%" stopColor="#E31C3D" />
              </linearGradient>
            </defs>
            <path
              d="M38 8 C20 10 9 20 9 33 c0 4 2 7 5 7 c13 0 24 -11 24 -27 c0 -2 0 -4 0 -5 Z"
              fill="url(#leafGrad)"
            />
            <path
              d="M14 38 C20 28 28 20 36 14"
              fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.85"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-tight">Sustainable Products</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">for a Better Tomorrow</p>
          </div>
        </div>
        <div className="flex justify-end mt-2 relative">
          <button
            onClick={() => setCurrentPage('eco-friendly-products')}
            className="h-8 px-4 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ background: RED }}
          >
            Explore Now <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

    </aside>
  )
}
