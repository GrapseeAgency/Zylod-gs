'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { getGreeting } from '@/lib/greeting'
import {
  ClipboardList,
  Heart,
  ShoppingCart,
  MessageSquare,
  Store,
  Shield,
  CreditCard,
  Banknote,
  ArrowRight,
} from 'lucide-react'

/* ─── Color Constants ─── */

const RED = '#E53935'
const BLUE = '#1976D2'
const GREEN = '#388E3C'

export function RightSidebar() {
  const { setCurrentPage } = useNavigationStore()
  const { isAuthenticated, user } = useAuthStore()

  return (
    <aside className="hidden xl:block w-[280px] shrink-0 space-y-3">

      {/* ═══════════ Widget 1: User Welcome / Dashboard Card ═══════════ */}
      <Card className="border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        <div className="p-4" style={{ background: '#FAFAFA' }}>
          {isAuthenticated && user ? (
            <>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: RED }}>
                  {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#212121' }}>{getGreeting()},</p>
                  <p className="text-xs font-semibold" style={{ color: RED }}>{user.fullName || 'User'}!</p>
                </div>
              </div>
              {/* Action Icons */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { icon: ClipboardList, label: 'Orders', page: 'orders' as const, color: RED },
                  { icon: Heart, label: 'Wishlist', page: 'wishlist' as const, color: '#AD1457' },
                  { icon: ShoppingCart, label: 'Cart', page: 'cart' as const, color: BLUE },
                  { icon: MessageSquare, label: 'Chat', page: 'chat-list' as const, color: GREEN },
                ].map((action, i) => {
                  const IconComp = action.icon
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(action.page)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ background: `${action.color}12` }}
                      >
                        <IconComp className="h-4 w-4" style={{ color: action.color }} />
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">{action.label}</span>
                    </button>
                  )
                })}
              </div>
              <Separator className="mb-3" />
              {/* Dashboard Features */}
              <div className="space-y-1.5 mb-3">
                {[
                  { label: 'Order Management', color: GREEN },
                  { label: 'Price Negotiations', color: BLUE },
                  { label: 'Supplier Verification', color: RED },
                  { label: 'Bulk Order Tracking', color: '#F57C00' },
                  { label: 'Secure Payments', color: '#388E3C' },
                ].map((feature) => (
                  <div key={feature.label} className="flex items-center gap-2">
                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14, color: feature.color, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>
                    <span className="text-[11px] text-gray-600 font-medium">{feature.label}</span>
                  </div>
                ))}
              </div>
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
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <div className="h-12 w-12 rounded-full mx-auto flex items-center justify-center mb-2" style={{ background: `${RED}12` }}>
                  <ShoppingCart className="h-6 w-6" style={{ color: RED }} />
                </div>
                <p className="text-sm font-bold" style={{ color: '#212121' }}>Sign in to Zylod</p>
                <p className="text-[11px] text-gray-500 mt-1">Access wholesale prices, track orders & chat with suppliers</p>
              </div>
              <Button
                className="w-full text-xs font-semibold mb-2"
                style={{ background: RED, color: '#fff' }}
                onClick={() => setCurrentPage('login')}
              >
                Login / Register
              </Button>
              <div className="grid grid-cols-2 gap-2 text-center">
                <button
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  onClick={() => setCurrentPage('register-buyer')}
                >
                  <ClipboardList className="h-4 w-4" style={{ color: RED }} />
                  <span className="text-[10px] font-medium" style={{ color: RED }}>Buyer</span>
                </button>
                <button
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-green-50 transition-colors"
                  onClick={() => setCurrentPage('register-supplier')}
                >
                  <Store className="h-4 w-4" style={{ color: GREEN }} />
                  <span className="text-[10px] font-medium" style={{ color: GREEN }}>Supplier</span>
                </button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ═══════════ Widget 2: B2B Services ═══════════ */}
      <Card className="border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        <div className="p-4" style={{ background: '#FAFAFA' }}>
          <p className="text-sm font-bold mb-3" style={{ color: RED }}>B2B Services</p>
          {[
            { icon: Store, label: 'Verified Suppliers', desc: 'Verified & trade assured', color: RED },
            { icon: Shield, label: 'Secure Transactions', desc: 'Trade assurance protection', color: BLUE },
            { icon: CreditCard, label: 'Flexible Payments', desc: 'bKash, Nagad, Bank', color: GREEN },
            { icon: Banknote, label: 'Credit Lines', desc: 'Net-30/60 payment terms', color: '#F57C00' },
          ].map((service) => {
            const ServiceIcon = service.icon
            return (
              <div key={service.label} className="flex items-center gap-3 mb-2.5">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${service.color}10` }}
                >
                  <ServiceIcon className="h-4.5 w-4.5" style={{ color: service.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold" style={{ color: '#212121' }}>{service.label}</p>
                  <p className="text-[10px] text-gray-400">{service.desc}</p>
                </div>
              </div>
            )
          })}
          <Button
            variant="outline"
            className="w-full text-xs font-semibold mt-1"
            style={{ borderColor: RED, color: RED }}
            onClick={() => setCurrentPage('suppliers')}
          >
            Find Suppliers <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </Card>

    </aside>
  )
}
