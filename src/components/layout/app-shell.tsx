'use client'

import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { VerificationBanner } from '@/components/layout/verification-banner'
import { MobileBottomNav } from '@/components/mobile/mobile-bottom-nav'
import { useIsMobile } from '@/hooks/use-mobile'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { ArrowLeft } from 'lucide-react'

/* ─── Page category helpers (compact) ─── */
const FULLSCREEN_PAGES = new Set([
  'welcome', 'onboarding', 'register', 'login', 'register-buyer', 'register-supplier',
  'otp-verification', 'forgot-password', 'reset-password', 'phone-verification',
  'email-verification', 'account-suspended', 'two-factor-auth', 'backup-codes',
  'account-recovery', 'checkout',
])

const DETAIL_PAGES = new Set([
  'product-detail', 'order-detail', 'chat-detail', 'order-processing',
])

function isCustomHeaderPage(page: string): boolean {
  // Pages that render their own header — just need bottom nav
  return page.startsWith('supplier-') || page.startsWith('buyer-') || page.startsWith('admin-') || page.startsWith('seller-') ||
    page.includes('-products') || page.includes('-orders') || page.includes('-reviews') ||
    page.includes('-dashboard') || page.includes('-profile') || page.includes('-settings') ||
    ['cart', 'wishlist', 'notifications', 'addresses', 'profile', 'explore',
     'category-products', 'search-results', 'compare', 'orders', 'checkout'].includes(page)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const currentPage = useNavigationStore((s) => s.currentPage)
  const { goBack } = useNavigationStore()

  // Fullscreen pages (welcome onboarding, auth) - render immediately without desktop header
  if (FULLSCREEN_PAGES.has(currentPage)) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    )
  }

  // Mobile layout
  if (isMobile) {
    // Home page has its own top nav + bottom nav
    if (currentPage === 'home') {
      return (
        <div className="min-h-screen bg-background">
          {children}
        </div>
      )
    }

    // Fullscreen pages (auth, checkout) - no nav at all
    if (FULLSCREEN_PAGES.has(currentPage)) {
      return (
        <div className="min-h-screen bg-background">
          {children}
        </div>
      )
    }

    // Pages with custom header - show bottom nav only, page handles its own header
    if (isCustomHeaderPage(currentPage)) {
      return (
        // data-zylod-nav-padding: native shells flatten this to 16px via
        // document-start CSS (the app's own bottom bar provides the inset).
        <div data-zylod-nav-padding="" className="min-h-screen pb-[calc(64px+env(safe-area-inset-bottom)+16px)]">
          <main className="flex-1">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      )
    }

    // Detail/sub pages - show back button + bottom nav
    if (DETAIL_PAGES.has(currentPage)) {
      return (
        <div data-zylod-nav-padding="" className="min-h-screen bg-background pb-[calc(64px+env(safe-area-inset-bottom)+16px)]">
          {/* Mobile top bar with back button */}
          <header className="sticky top-0 z-50 flex items-center gap-3 px-4 h-12 bg-background border-b border-border/50">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg active:scale-95 transition-transform"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-sm font-semibold text-foreground capitalize">
              {currentPage.replace(/-/g, ' ')}
            </h1>
          </header>
          <main className="flex-1">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      )
    }

    // Default mobile layout - show bottom nav
    return (
      <div data-zylod-nav-padding="" className="min-h-screen bg-background pb-[calc(64px+env(safe-area-inset-bottom)+16px)]">
        <main className="flex-1">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <VerificationBanner />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
