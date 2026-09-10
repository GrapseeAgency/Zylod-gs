'use client'

import { Bell, Menu, QrCode, X, Zap, Clock, Globe, Scissors, Shield, Store, CreditCard, Banknote, Package, Heart, ClipboardList, Truck, Award, Headphones } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useNotificationStore } from '@/store/notification-store'
import { useAuthStore } from '@/store/auth-store'
import { useState, useEffect } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

/* ─── Menu items organized in sections ─── */
const DEAL_SERVICES = [
  { icon: Scissors, label: 'Daily Deals', desc: 'Bulk discounts', color: '#E53935', page: 'daily-deals' as const },
  { icon: Globe, label: 'Cross-border', desc: 'International sourcing', color: '#1976D2', page: 'cross-border' as const },
  { icon: Clock, label: 'Flash Sale', desc: 'Limited time offers', color: '#F57C00', page: 'flash-sale' as const },
  { icon: Zap, label: 'Factory Direct', desc: 'Direct from manufacturers', color: '#E53935', page: 'factory-direct' as const },
]

const B2B_SERVICES = [
  { icon: Store, label: 'Verified Suppliers', desc: 'Verified & trade assured', color: '#388E3C', page: 'suppliers' as const },
  { icon: Shield, label: 'Trade Assurance', desc: 'Secure transactions', color: '#1976D2', page: 'suppliers' as const },
  { icon: CreditCard, label: 'Flexible Payments', desc: 'bKash, Nagad, Bank', color: '#388E3C', page: 'payment-method' as const },
  { icon: Banknote, label: 'Credit Lines', desc: 'Net-30/60 terms', color: '#F57C00', page: 'buyer-dashboard' as const },
  { icon: Truck, label: 'Shipping & Logistics', desc: 'Door-to-door delivery', color: '#6A1B9A', page: 'shipping-calculator' as const },
  { icon: Award, label: 'Quality Inspection', desc: 'Pre-shipment QC', color: '#00695C', page: 'quality-guarantee' as const },
]

const QUICK_ACCESS = [
  { icon: ClipboardList, label: 'My Orders', page: 'orders' as const, color: '#E53935' },
  { icon: Heart, label: 'Wishlist', page: 'wishlist' as const, color: '#AD1457' },
  { icon: Package, label: 'My Cart', page: 'cart' as const, color: '#1976D2' },
  { icon: Headphones, label: 'Help Center', page: 'help-center' as const, color: '#388E3C' },
]

export function MobileTopNav() {
  const { navigate } = useNavigationStore()
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = notifications.filter((n) => !n.isRead).length
  const { isAuthenticated } = useAuthStore()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-50 flex items-center justify-between px-4 h-12 bg-background border-b transition-all duration-200 ${
          scrolled
            ? 'border-border/50 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
            : 'border-transparent'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('barcode-scanner')}
            className="p-1 rounded-lg active:scale-95 transition-transform"
            aria-label="Scan QR Code"
          >
            <QrCode className="w-[18px] h-[18px] text-primary" />
          </button>
          <img
            src="/zylod-logo.svg"
            alt="Zylod"
            className="h-7 w-auto"
          />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => navigate('notifications')}
            className="relative p-2 rounded-lg active:scale-95 transition-transform"
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px] text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {/* 3-line hamburger menu */}
          <button
            onClick={openServicesMenu}
            className="p-2 rounded-lg active:scale-95 transition-transform"
            aria-label="Menu"
          >
            <Menu className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Services Menu Drawer */}
      <ServicesDrawer open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  )
}

/** Global event name used by any top bar variant to open the services drawer. */
export const OPEN_SERVICES_MENU_EVENT = 'zylod-open-services-menu'

/** Fire-and-forget helper for opening the services drawer from anywhere. */
export function openServicesMenu() {
  window.dispatchEvent(new CustomEvent(OPEN_SERVICES_MENU_EVENT))
}

/**
 * Always-mountable services drawer. Lives outside the swap-between-top-bars
 * tree so the menu stays reachable whether the full nav or the sticky search
 * bar is currently displayed.
 */
export function MobileServicesDrawer() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_SERVICES_MENU_EVENT, handler)
    return () => window.removeEventListener(OPEN_SERVICES_MENU_EVENT, handler)
  }, [])

  return <ServicesDrawer open={open} onOpenChange={setOpen} />
}

function ServicesDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { navigate } = useNavigationStore()
  const { isAuthenticated } = useAuthStore()

  return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              Services & Deals
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-2 max-h-[70vh] overflow-y-auto">
            {/* Deals & Promotions */}
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Deals & Promotions</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {DEAL_SERVICES.map((item) => {
                const IconComp = item.icon
                return (
                  <button
                    key={item.label}
                    onClick={() => { onOpenChange(false); navigate(item.page) }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl active:scale-95 transition-transform"
                  >
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${item.color}15` }}
                    >
                      <IconComp className="h-5 w-5" style={{ color: item.color }} />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground text-center leading-tight">{item.label}</span>
                  </button>
                )
              })}
            </div>

            <Separator className="mb-3" />

            {/* B2B Services */}
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">B2B Services</p>
            <div className="space-y-0.5 mb-4">
              {B2B_SERVICES.map((item) => {
                const IconComp = item.icon
                return (
                  <button
                    key={item.label}
                    onClick={() => { onOpenChange(false); navigate(item.page) }}
                    className="flex items-center gap-3 w-full py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors active:bg-muted text-left"
                  >
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${item.color}12` }}
                    >
                      <IconComp className="h-4 w-4" style={{ color: item.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <Separator className="mb-3" />

            {/* Quick Access */}
            {isAuthenticated && (
              <>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Quick Access</p>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {QUICK_ACCESS.map((item) => {
                    const IconComp = item.icon
                    return (
                      <button
                        key={item.label}
                        onClick={() => { onOpenChange(false); navigate(item.page) }}
                        className="flex flex-col items-center gap-1.5 p-2 rounded-xl active:scale-95 transition-transform"
                      >
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center"
                          style={{ background: `${item.color}12` }}
                        >
                          <IconComp className="h-4 w-4" style={{ color: item.color }} />
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
  )
}
