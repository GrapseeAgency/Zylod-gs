'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Home,
  ShoppingCart,
  Tag,
  Building2,
  MoreHorizontal,
  Globe,
  Search,
  User,
  Heart,
  Zap,
  Clock,
  ArrowRightLeft,
  Factory,
  History,
  GitCompare,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'

/* ─── Nav items ─── */
interface NavItem {
  label: string
  page: string
  icon: React.ReactNode
}

const mainNavItems: NavItem[] = [
  { label: 'Home', page: 'home', icon: <Home className="h-4 w-4" /> },
  { label: 'Cart', page: 'cart', icon: <ShoppingCart className="h-4 w-4" /> },
  { label: 'Deals', page: 'daily-deals', icon: <Tag className="h-4 w-4" /> },
  { label: 'Suppliers', page: 'suppliers', icon: <Building2 className="h-4 w-4" /> },
]

const moreNavItems: NavItem[] = [
  { label: 'Flash Sale', page: 'flash-sale', icon: <Zap className="h-4 w-4" /> },
  { label: 'Coupons', page: 'coupons', icon: <Tag className="h-4 w-4" /> },
  { label: 'Factory Direct', page: 'factory-direct', icon: <Factory className="h-4 w-4" /> },
  { label: 'Wishlist', page: 'wishlist', icon: <Heart className="h-4 w-4" /> },
  { label: 'Orders', page: 'orders', icon: <Clock className="h-4 w-4" /> },
  { label: 'About Zylod', page: 'about-us', icon: <Building2 className="h-4 w-4" /> },
  { label: 'Careers', page: 'careers-page', icon: <User className="h-4 w-4" /> },
  { label: 'Press & Media', page: 'press-media', icon: <Globe className="h-4 w-4" /> },
  { label: 'Investor Relations', page: 'investor-relations', icon: <Building2 className="h-4 w-4" /> },
  { label: 'Terms of Service', page: 'terms-of-service', icon: <MoreHorizontal className="h-4 w-4" /> },
  { label: 'Privacy Policy', page: 'privacy-policy', icon: <MoreHorizontal className="h-4 w-4" /> },
  { label: 'Sitemap', page: 'sitemap', icon: <Search className="h-4 w-4" /> },
]

const languages = [
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
]

interface MobileMenuProps {
  selectedLang: string
}

export function MobileMenu({ selectedLang }: MobileMenuProps) {
  const { currentPage, navigate } = useNavigationStore()
  const { isAuthenticated, user, logout } = useAuthStore()
  const { currentCurrency, getCurrencyInfo } = useCurrencyStore()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const handleNavClick = (page: string) => {
    navigate(page as any)
    setMobileOpen(false)
  }

  const isPageActive = (page: string) => currentPage === page

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" aria-label="Open menu">
          <Menu className="h-5 w-5"  />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        {/* Mobile menu header */}
        <div className="flex items-center gap-2 px-4 py-4 border-b">
          <img src="/zylod-logo.svg" alt="Zylod" className="h-9 w-auto" />
        </div>

        {/* Mobile nav items */}
        <nav className="flex flex-col px-2 py-2">
          {mainNavItems.map((item) => {
            const active = isPageActive(item.page)
            return (
              <button
                key={item.page}
                onClick={() => handleNavClick(item.page)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors active:scale-[0.98]',
                  active
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {item.icon}
                {item.label}
                {active && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}

          {/* More section */}
          <div className="mt-2 pt-2 border-t">
            <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">More</p>
            {moreNavItems.map((item) => {
              const active = isPageActive(item.page)
              return (
                <button
                  key={item.page}
                  onClick={() => handleNavClick(item.page)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full active:scale-[0.98]',
                    active
                      ? 'text-red-600 bg-red-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Mobile bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 border-t p-4 bg-card">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Language: {languages.find(l => l.code === selectedLang)?.label}</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm">{getCurrencyInfo().symbol}</span>
            <span className="text-sm text-gray-600">Currency: {currentCurrency}</span>
          </div>
          {isAuthenticated ? (
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => { logout(); navigate('home'); setMobileOpen(false) }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          ) : (
            <Button
              className="w-full text-white font-semibold bg-primary"
              onClick={() => { navigate('login'); setMobileOpen(false) }}
            >
              <User className="h-4 w-4 mr-2" /> Login / Register
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
