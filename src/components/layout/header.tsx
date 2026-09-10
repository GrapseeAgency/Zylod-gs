'use client'

import { useState, useEffect, useSyncExternalStore, useCallback, Suspense, lazy } from 'react'
import { createPortal } from 'react-dom'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCartStore } from '@/store/cart-store'
import { useCurrencyStore, CURRENCIES, type CurrencyCode } from '@/store/currency-store'
import { useNotificationStore } from '@/store/notification-store'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Home,
  ShoppingCart,
  Tag,
  Building2,
  MoreHorizontal,
  Globe,
  Bell,
  User,
  Clock,
  ChevronDown,
  LogOut,
  Menu,
  Sun,
  Moon,
  Zap,
  Check,
  MessageSquare,
  TrendingDown,
  Shield,
  Star,
  Truck,
  Info,
  Gift,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Lazy-loaded heavy sub-components ─── */
const MobileMenu = lazy(() =>
  import('@/components/layout/mobile-menu').then((m) => ({ default: m.MobileMenu }))
)

/* ------------------------------------------------------------------ */
/*  Navigation items                                                   */
/* ------------------------------------------------------------------ */
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
  { label: 'Flash Sale', page: 'flash-sale', icon: <Zap className="h-4 w-4" /> },
  { label: 'Coupons', page: 'coupons', icon: null },
]

const moreNavItems: NavItem[] = [
  { label: 'Factory Direct', page: 'factory-direct', icon: null },
  { label: 'Wishlist', page: 'wishlist', icon: null },
  { label: 'Orders', page: 'orders', icon: null },
  { label: 'About Zylod', page: 'about-us', icon: null },
  { label: 'Careers', page: 'careers-page', icon: null },
  { label: 'Press & Media', page: 'press-media', icon: null },
  { label: 'Investor Relations', page: 'investor-relations', icon: null },
  { label: 'Terms of Service', page: 'terms-of-service', icon: null },
  { label: 'Privacy Policy', page: 'privacy-policy', icon: null },
  { label: 'Platform Sitemap', page: 'sitemap', icon: null },
]

const languages = [
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
]

/* ------------------------------------------------------------------ */
/*  Notification helpers                                                */
/* ------------------------------------------------------------------ */
function getNotifIcon(type: string) {
  switch (type) {
    case 'order-update': return <Truck className="h-4 w-4 text-muted-foreground" />
    case 'new-message': return <MessageSquare className="h-4 w-4 text-muted-foreground" />
    case 'price-drop': return <TrendingDown className="h-4 w-4 text-muted-foreground" />
    case 'verification-status': return <Shield className="h-4 w-4 text-muted-foreground" />
    case 'deal-alert': return <Tag className="h-4 w-4 text-muted-foreground" />
    case 'system': return <Info className="h-4 w-4 text-muted-foreground" />
    case 'review': return <Star className="h-4 w-4 text-muted-foreground" />
    case 'promotion': return <Gift className="h-4 w-4 text-muted-foreground" />
    default: return <Bell className="h-4 w-4 text-muted-foreground" />
  }
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/* ------------------------------------------------------------------ */
/*  DropdownOverlay Component (Portal-based)                           */
/*  Uses createPortal to render outside the page layout, with a       */
/*  full-viewport backdrop, body scroll lock, and z-[9999].           */
/*  CSS transitions handle enter/exit animations without needing      */
/*  two-phase state (avoids lint error: set-state-in-effect).        */
/* ------------------------------------------------------------------ */
interface DropdownOverlayProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  /** Position from the right edge of viewport (px) */
  right?: number
  /** Position from the top of viewport (px) — defaults to below header */
  top?: number
  /** Width class for the panel */
  widthClass?: string
}

function DropdownOverlay({
  isOpen,
  onClose,
  children,
  right = 16,
  top = 68,
  widthClass = 'w-[300px] sm:w-[360px]',
}: DropdownOverlayProps) {
  /* Only render on client side — useSyncExternalStore avoids the
     "setState in effect" lint rule while still hydrating correctly. */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  /* Lock body scroll while open */
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [isOpen])

  /* Close on Escape key */
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[9999] transition-opacity duration-200',
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      aria-modal={isOpen || undefined}
      role={isOpen ? 'dialog' : undefined}
      aria-hidden={!isOpen}
    >
      {/* Semi-transparent backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dropdown panel */}
      <div
        className={cn(
          'absolute bg-popover shadow-2xl rounded-lg border border-border overflow-hidden',
          'transition-all duration-200',
          widthClass,
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        )}
        style={{ right: `${right}px`, top: `${top}px` }}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

/* ------------------------------------------------------------------ */
/*  Header Component                                                    */
/* ------------------------------------------------------------------ */
export function Header() {
  const { currentPage, navigate } = useNavigationStore()
  const { currentCurrency, setCurrency, getCurrencyInfo, fetchLiveRates } = useCurrencyStore()
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications } = useNotificationStore()
  const { isAuthenticated, user, logout } = useAuthStore()
  const { getItemCount } = useCartStore()
  const { theme, setTheme } = useTheme()

  const [selectedLang, setSelectedLang] = useState('en')
  const [scrolled, setScrolled] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const itemCount = getItemCount()

  /* Fetch live currency rates on mount */
  useEffect(() => {
    fetchLiveRates()
  }, [fetchLiveRates])

  /* Fetch notifications when authenticated */
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications()
    }
  }, [isAuthenticated, fetchNotifications])

  /* Track scroll for shadow enhancement */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Only one dropdown can be open at a time */
  const openNotif = useCallback(() => {
    setCurrencyOpen(false)
    setNotifOpen(true)
  }, [])

  const openCurrency = useCallback(() => {
    setNotifOpen(false)
    setCurrencyOpen(true)
  }, [])

  const closeNotif = useCallback(() => setNotifOpen(false), [])
  const closeCurrency = useCallback(() => setCurrencyOpen(false), [])

  const handleNavClick = (page: string) => {
    navigate(page as any)
  }

  const isPageActive = (page: string) => currentPage === page

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full bg-background transition-shadow duration-200',
          scrolled ? 'shadow-md' : 'shadow-sm'
        )}
      >
        <div className="mx-auto flex h-[60px] max-w-7xl items-center gap-3 px-4 lg:px-6">
          {/* -------------------------------------------------------- */}
          {/*  LEFT: Logo                                              */}
          {/* -------------------------------------------------------- */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('home')}
              className="flex items-center gap-2 group transition-transform active:scale-95"
              aria-label="Go to homepage"
            >
              <img
                src="/zylod-logo.svg"
                alt="Zylod"
                className="h-8 sm:h-9 w-auto transition-transform duration-200 group-hover:scale-[1.03]"
              />
            </button>
          </div>

          {/* -------------------------------------------------------- */}
          {/*  CENTER: Navigation Links (Desktop)                      */}
          {/* -------------------------------------------------------- */}
          <nav className="hidden lg:flex items-center gap-1 ml-auto mr-auto">
            {mainNavItems.map((item) => {
              const active = isPageActive(item.page)
              return (
                <button
                  key={item.page}
                  onClick={() => handleNavClick(item.page)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all hover:-translate-y-0.5 active:scale-[0.97]',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {/* Active indicator */}
                  {active && (
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}

            {/* More Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    moreNavItems.some((i) => isPageActive(i.page))
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span>More</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48">
                {moreNavItems.map((item) => (
                  <DropdownMenuItem
                    key={item.page}
                    onClick={() => handleNavClick(item.page)}
                    className={cn(
                      'gap-2 cursor-pointer',
                      isPageActive(item.page) && 'text-primary font-medium'
                    )}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* -------------------------------------------------------- */}
          {/*  RIGHT: Utility Icons + Login                            */}
          {/* -------------------------------------------------------- */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto lg:ml-0">
            {/* Theme Toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 relative"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-foreground transition-transform duration-300 rotate-0 scale-100" />
                ) : (
                  <Moon className="h-5 w-5 text-foreground transition-transform duration-300 rotate-0 scale-100" />
                )}
              </Button>
            )}

            {/* Language / Globe */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 relative" aria-label="Switch language">
                  <Globe className="h-5 w-5 text-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setSelectedLang(lang.code)}
                    className={cn(
                      'cursor-pointer',
                      selectedLang === lang.code && 'font-semibold text-primary'
                    )}
                  >
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Bell — triggers portal overlay */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 relative"
              aria-label="Notifications"
              onClick={notifOpen ? closeNotif : openNotif}
            >
              <Bell className="h-5 w-5 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground bg-primary px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Currency Selector — triggers portal overlay */}
            <button
              className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              aria-label="Currency selector"
              onClick={currencyOpen ? closeCurrency : openCurrency}
            >
              <span className="text-base">{getCurrencyInfo().symbol}</span>
              <span>{currentCurrency}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>

            {/* Auth / Login Button */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 gap-2 px-2"
                  >
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground bg-primary">
                      {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                    <span className="hidden sm:inline text-sm max-w-[80px] truncate text-foreground">
                      {user.fullName || 'User'}
                    </span>
                    <ChevronDown className="h-3 w-3 hidden sm:inline text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="font-medium text-sm text-foreground">{user.fullName || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user.email || user.phone}</p>
                    <Badge variant="outline" className="mt-1 text-xs capitalize">{user.userType}</Badge>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('profile')} className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('my-orders')} className="cursor-pointer">
                    <Clock className="h-4 w-4 mr-2" /> Orders
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { logout(); navigate('home') }}
                    className="text-destructive cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => navigate('login')}
                className="h-9 px-5 rounded-md text-sm font-semibold text-primary-foreground border-0 hover:shadow-md transition-all hover:scale-[1.03] active:scale-[0.97] bg-primary"
              >
                <User className="h-4 w-4 mr-1.5" />
                Login
              </Button>
            )}

            {/* Mobile hamburger menu (lazy-loaded) */}
            <Suspense fallback={
              <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" aria-label="Menu loading">
                <Menu className="h-5 w-5 text-foreground" />
              </Button>
            }>
              <MobileMenu
                selectedLang={selectedLang}
              />
            </Suspense>
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────── */}
      {/*  Portal Overlays (rendered outside the header DOM tree)     */}
      {/*  These are portaled to document.body so they are fully       */}
      {/*  isolated from the page layout and cannot be clipped or      */}
      {/*  overlapped by any other content (including the footer).     */}
      {/* ──────────────────────────────────────────────────────────── */}

      {/* Notification Overlay */}
      <DropdownOverlay
        isOpen={notifOpen}
        onClose={closeNotif}
        right={16}
        top={68}
        widthClass="w-[calc(100vw-2rem)] sm:w-[360px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-primary px-2" onClick={markAllAsRead}>
                <Check className="h-3 w-3 mr-1" /> Mark all read
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeNotif} aria-label="Close notifications">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.slice(0, 10).map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors',
                    !notif.isRead && 'bg-primary/5'
                  )}
                  onClick={() => {
                    markAsRead(notif.id)
                    if (notif.actionUrl) {
                      closeNotif()
                      if (notif.actionUrl.includes('/orders/')) navigate('order-detail', { orderId: notif.relatedId || '' })
                      else if (notif.actionUrl.includes('/chat/')) navigate('chat-detail', { conversationId: notif.relatedId || '' })
                      else if (notif.actionUrl.includes('/products/')) navigate('product-detail', { productId: notif.relatedId || '' })
                      else if (notif.actionUrl.includes('/flash-sale')) navigate('flash-sale')
                      else if (notif.actionUrl.includes('/daily-deals')) navigate('daily-deals')
                      else if (notif.actionUrl.includes('/suppliers/')) navigate('suppliers')
                      else navigate('notifications')
                    }
                  }}
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0 rounded-full bg-muted p-1.5">
                    {getNotifIcon(notif.type)}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm leading-tight', !notif.isRead ? 'font-semibold' : 'font-normal text-foreground/80')}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{notif.message}</p>
                    <span className="text-[11px] text-muted-foreground/70 mt-1 block">{timeAgo(notif.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-primary font-medium"
            onClick={() => { closeNotif(); navigate('notifications') }}
          >
            View All Notifications
          </Button>
        </div>
      </DropdownOverlay>

      {/* Currency Overlay */}
      <DropdownOverlay
        isOpen={currencyOpen}
        onClose={closeCurrency}
        right={16}
        top={68}
        widthClass="w-[calc(100vw-2rem)] sm:w-[240px]"
      >
        <div className="px-3 py-2.5 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Select Currency</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Prices will convert in real-time</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeCurrency} aria-label="Close currency selector">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="p-1.5">
            {Object.values(CURRENCIES).map((curr) => (
              <button
                key={curr.code}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer',
                  currentCurrency === curr.code
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                onClick={() => { setCurrency(curr.code); closeCurrency() }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base w-6 text-center">{curr.symbol}</span>
                  <span>{curr.code}</span>
                </span>
                <span className="text-xs text-muted-foreground">{curr.name.split(' ').pop()}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
        <div className="border-t px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live rates • 1 BDT = {getCurrencyInfo().symbol}{currentCurrency === 'BDT' ? '1.00' : getCurrencyInfo().rate.toFixed(4)} {currentCurrency}
            {getCurrencyInfo().change24h !== 0 && (
              <span className={getCurrencyInfo().change24h > 0 ? 'text-green-600' : 'text-red-600'}>
                ({getCurrencyInfo().change24h > 0 ? '+' : ''}{(getCurrencyInfo().change24h * 100).toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
      </DropdownOverlay>
    </>
  )
}
