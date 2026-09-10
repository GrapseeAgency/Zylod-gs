'use client'

import { useState, useEffect } from 'react'
import { MobileTopNav, MobileServicesDrawer, openServicesMenu } from './mobile-top-nav'
import { MobileSearchBar } from './mobile-search-bar'
import { MobileCategoryPills } from './mobile-category-pills'
import { MobilePromoIconGrid } from './mobile-promo-icon-grid'
import { MobileSubsidySection } from './mobile-subsidy-section'
import { MobileProductGrid } from './mobile-product-grid'
import { MobileBottomNav } from './mobile-bottom-nav'
import { MobileHomeLoading } from '@/components/shared/loading-skeletons'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, Menu } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useNotificationStore } from '@/store/notification-store'
import { useProductStore } from '@/store/product-store'

/* ─── Sticky search bar that appears on scroll ─── */
function StickySearchBar() {
  const { navigate } = useNavigationStore()
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex items-center gap-2 px-3 h-11 bg-background border-b border-border/50 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      {/* Search bar button */}
      <button
        onClick={() => {
          // Scroll to top and focus search
          window.scrollTo({ top: 0, behavior: 'smooth' })
          // Focus the search input after a short delay
          setTimeout(() => {
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
            if (searchInput) searchInput.focus()
          }, 300)
        }}
        className="flex-1 flex items-center gap-2 bg-muted/60 rounded-full px-3 h-8 text-left"
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">Search products, suppliers...</span>
      </button>
      {/* Services menu — stays reachable when the full top nav is swapped out */}
      <button
        onClick={openServicesMenu}
        className="p-1.5 rounded-lg active:scale-95 transition-transform"
        aria-label="Menu"
      >
        <Menu className="w-[18px] h-[18px] text-muted-foreground" />
      </button>
      {/* Notification */}
      <button
        onClick={() => navigate('notifications')}
        className="relative p-1.5 rounded-lg active:scale-95 transition-transform"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px] text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  )
}

export function MobileHomePage() {
  const [isReady, setIsReady] = useState(false)
  const [showStickySearch, setShowStickySearch] = useState(false)
  const { initialize } = useProductStore()

  useEffect(() => {
    // Initialize product store from API
    initialize()
    // Small delay to ensure smooth transition
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [initialize])

  // Listen for scroll to show sticky search bar
  useEffect(() => {
    const handleScroll = () => {
      // Show sticky search when scrolled past the initial search bar area (~120px)
      setShowStickySearch(window.scrollY > 120)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isReady) {
    return <MobileHomeLoading />
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(64px+env(safe-area-inset-bottom)+16px)]">
      {/* Services drawer — mounted once, reachable from both top-bar variants */}
      <MobileServicesDrawer />
      {/* Fixed top navigation - hidden when sticky search is shown */}
      <AnimatePresence>
        {!showStickySearch && (
          <motion.div
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -48, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed top-0 left-0 w-full z-50"
          >
            <MobileTopNav />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky search bar - appears on scroll */}
      <AnimatePresence>
        {showStickySearch && (
          <motion.div
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -48, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed top-0 left-0 w-full z-50"
          >
            <StickySearchBar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content area */}
      <main className="pt-12 px-3">
        {/* Search bar with suggestions and tools */}
        <MobileSearchBar />

        {/* Category pill scroller with proper icons */}
        <MobileCategoryPills />

        {/* Quick Access — single horizontal scroll row */}
        <MobilePromoIconGrid />

        {/* Super Deals / Subsidy horizontal scroll */}
        <MobileSubsidySection />

        {/* Product grid with infinite scroll - main content */}
        <MobileProductGrid />

        {/* Bottom spacing for nav */}
        <div className="h-8" />
      </main>

      {/* Fixed bottom navigation */}
      <MobileBottomNav />
    </div>
  )
}
