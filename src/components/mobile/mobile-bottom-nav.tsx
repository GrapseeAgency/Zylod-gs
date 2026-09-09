'use client'

import { Home, Grid3X3, Zap, ShoppingCart, User } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCartStore } from '@/store/cart-store'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  pageId: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, pageId: 'home' },
  { id: 'categories', label: 'Categories', icon: Grid3X3, pageId: 'category-browser' },
  { id: 'deals', label: 'Hot Deals', icon: Zap, pageId: 'flash-deals' },
  { id: 'cart', label: 'Cart', icon: ShoppingCart, pageId: 'cart' },
  { id: 'profile', label: 'Profile', icon: User, pageId: 'profile' },
]

export function MobileBottomNav() {
  const { currentPage, navigate } = useNavigationStore()
  const { isAuthenticated } = useAuthStore()
  const cartItems = useCartStore((s) => s.items)
  // Distinct products in cart — not summed quantity (MOQ would show 99+ after one add)
  const cartCount = cartItems.length

  const getActiveId = (): string => {
    if (currentPage === 'home') return 'home'
    if (['category-products', 'category-browser', 'textiles-fabrics', 'agriculture-food', 'electronics', 'construction', 'packaging', 'home-garden', 'gifts-crafts', 'beauty-personal-care', 'promotional-items', 'garments', 'spices', 'mobile-accessories', 'led-lighting', 'automotive', 'sports-fitness', 'books-stationery', 'toys', 'jewelry', 'medical-supplies', 'furniture'].includes(currentPage)) return 'categories'
    if (['chat-list', 'chat-detail', 'messages'].includes(currentPage)) return 'profile'
    if (['flash-sale', 'flash-deals', 'daily-deals'].includes(currentPage)) return 'deals'
    if (['cart', 'checkout'].includes(currentPage)) return 'cart'
    if (['profile', 'buyer-dashboard', 'buyer-orders', 'buyer-wishlist', 'buyer-settings', 'buyer-profile', 'supplier-dashboard', 'supplier-profile', 'admin-dashboard', 'notification-preferences', 'privacy-settings', 'language-settings', 'theme-settings', 'linked-accounts', 'business-profile'].includes(currentPage)) return 'profile'
    return 'home'
  }

  const activeId = getActiveId()

  const handleNavClick = (item: NavItem) => {
    if (item.id === 'profile' && !isAuthenticated) {
      navigate('login')
      return
    }
    navigate(item.pageId as any)
  }

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-background border-t border-border/50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`
                flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-all active:scale-95 relative
                ${isActive ? 'text-primary' : 'text-muted-foreground'}
              `}
            >
              {/* Active indicator dot */}
              {isActive && (
                <div className="absolute -top-1.5 w-4 h-0.5 bg-primary rounded-full" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-all ${isActive ? 'scale-110' : ''}`} />
                {/* Cart badge */}
                {item.id === 'cart' && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
