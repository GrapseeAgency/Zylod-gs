'use client'

import { useAuthStore } from '@/store/auth-store'
import { useNavigationStore } from '@/store/navigation-store'
import { getGreeting } from '@/lib/greeting'
import { ClipboardList, Heart, ShoppingCart, MessageSquare, Store, LogIn } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const QUICK_ACTIONS = [
  { icon: ClipboardList, label: 'Orders', page: 'orders' as const, color: '#E53935' },
  { icon: Heart, label: 'Wishlist', page: 'wishlist' as const, color: '#AD1457' },
  { icon: ShoppingCart, label: 'Cart', page: 'cart' as const, color: '#1976D2' },
  { icon: MessageSquare, label: 'Chat', page: 'chat-list' as const, color: '#388E3C' },
]

const DASHBOARD_FEATURES = [
  { label: 'Order Management', color: '#388E3C' },
  { label: 'Price Negotiations', color: '#1976D2' },
  { label: 'Supplier Verification', color: '#E53935' },
  { label: 'Bulk Order Tracking', color: '#F57C00' },
  { label: 'Secure Payments', color: '#388E3C' },
]

export function MobileUserCard() {
  const { isAuthenticated, user } = useAuthStore()
  const { navigate } = useNavigationStore()

  return (
    <section className="mt-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="bg-card rounded-xl border border-border/50 p-4"
      >
        {isAuthenticated && user ? (
          <>
            {/* Authenticated user */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-primary">
                {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{getGreeting()},</p>
                <p className="text-xs font-semibold text-primary">{user.fullName || 'User'}!</p>
              </div>
            </div>

            {/* Quick action icons */}
            <div className="grid grid-cols-4 gap-1 mb-3">
              {QUICK_ACTIONS.map((action, i) => {
                const IconComp = action.icon
                return (
                  <button
                    key={i}
                    onClick={() => navigate(action.page)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg active:scale-95 transition-transform"
                  >
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${action.color}12` }}
                    >
                      <IconComp className="h-4 w-4" style={{ color: action.color }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">{action.label}</span>
                  </button>
                )
              })}
            </div>

            <Separator className="mb-3" />

            {/* Dashboard features */}
            <div className="space-y-1.5 mb-3">
              {DASHBOARD_FEATURES.map((feature) => (
                <div key={feature.label} className="flex items-center gap-2">
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14, color: feature.color, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>
                  <span className="text-[11px] text-muted-foreground font-medium">{feature.label}</span>
                </div>
              ))}
            </div>

            <Button
              className="w-full text-xs font-semibold bg-primary text-primary-foreground"
              onClick={() => {
                const role = user?.userType
                if (role === 'admin') navigate('admin-dashboard')
                else if (role === 'supplier') navigate('supplier-dashboard')
                else navigate('buyer-dashboard')
              }}
            >
              Go to Dashboard
            </Button>
          </>
        ) : (
          <>
            {/* Guest user */}
            <div className="text-center mb-3">
              <div className="h-11 w-11 rounded-full mx-auto flex items-center justify-center mb-2 bg-primary/10">
                <LogIn className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-bold text-foreground">Sign in to Zylod</p>
              <p className="text-[11px] text-muted-foreground mt-1">Access wholesale prices, track orders & chat with suppliers</p>
            </div>

            <Button
              className="w-full text-xs font-semibold mb-2 bg-primary text-primary-foreground"
              onClick={() => navigate('login')}
            >
              Login / Register
            </Button>

            <div className="grid grid-cols-2 gap-2 text-center">
              <button
                className="flex flex-col items-center gap-1 p-2 rounded-lg active:scale-95 transition-transform bg-red-50/50"
                onClick={() => navigate('register-buyer')}
              >
                <ClipboardList className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-medium text-primary">Buyer</span>
              </button>
              <button
                className="flex flex-col items-center gap-1 p-2 rounded-lg active:scale-95 transition-transform bg-green-50/50"
                onClick={() => navigate('register-supplier')}
              >
                <Store className="h-4 w-4 text-green-600" />
                <span className="text-[10px] font-medium text-green-600">Supplier</span>
              </button>
            </div>
          </>
        )}
      </motion.div>
    </section>
  )
}
