'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Search,
  Camera,
  QrCode,
  Mic,
  X,
  PackageCheck,
  Building2,
  Tag,
  Truck,
  HelpCircle,
  FileText,
  Wallet,
  ShieldCheck,
  Store,
  Layers,
  ArrowRight,
  Clock,
  ExternalLink,
  Sliders,
  BadgePercent,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'

const RECENT_INTERNAL_SEARCHES_KEY = 'zylod_recent_internal_searches'

export interface InternalDestination {
  id: string
  title: string
  subtitle: string
  page: string
  params?: Record<string, string>
  category: 'tool' | 'page' | 'supplier' | 'support' | 'finance'
  badge?: string
  keywords: string[]
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
}

// Canonical directory of all internal destinations & tools
const INTERNAL_DIRECTORY: InternalDestination[] = [
  // 1. Logistics & Orders
  {
    id: 'dest-order-tracking',
    title: 'Order Tracking',
    subtitle: 'Track live consignment & shipment delivery status',
    page: 'order-tracking',
    category: 'tool',
    badge: 'Logistics',
    keywords: ['track', 'order', 'tracking', 'shipment', 'consignment', 'delivery', 'parcel', 'where is my order', 'status'],
    icon: PackageCheck,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/5 dark:bg-primary/10',
  },
  {
    id: 'dest-logistics-hub',
    title: 'Wholesale Logistics & Freight',
    subtitle: 'Nationwide freight rates, shipping zones & warehousing',
    page: 'logistics',
    category: 'page',
    badge: 'Freight',
    keywords: ['logistics', 'shipping', 'freight', 'transport', 'cargo', 'carrier', 'truck', 'courier', 'rates'],
    icon: Truck,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/5 dark:bg-primary/10',
  },
  {
    id: 'dest-order-history',
    title: 'My Purchase Orders',
    subtitle: 'View all completed, pending, and draft wholesale orders',
    page: 'orders-history',
    category: 'page',
    badge: 'Account',
    keywords: ['orders', 'purchase history', 'my orders', 'invoices', 'receipts', 'past orders'],
    icon: FileText,
    iconColor: 'text-gray-600 dark:text-gray-300',
    iconBg: 'bg-gray-50 dark:bg-gray-900',
  },

  // 2. Suppliers & RFQ
  {
    id: 'dest-suppliers-directory',
    title: 'Verified Suppliers Directory',
    subtitle: 'Discover ISO-certified manufacturers and factory suppliers',
    page: 'suppliers',
    category: 'supplier',
    badge: 'Directory',
    keywords: ['supplier', 'suppliers', 'vendor', 'vendors', 'manufacturer', 'factory', 'wholesaler', 'mills', 'producers'],
    icon: Building2,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    id: 'dest-rfq-hub',
    title: 'RFQ & Custom Quotes',
    subtitle: 'Submit requests for quotation and negotiate wholesale pricing',
    page: 'rfq-list',
    category: 'tool',
    badge: 'B2B RFQ',
    keywords: ['rfq', 'quote', 'quotation', 'bulk inquiry', 'custom orders', 'request for quote', 'negotiate'],
    icon: Sliders,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    id: 'dest-manufacturing-partners',
    title: 'Manufacturing Partners',
    subtitle: 'OEM & ODM factory partners across Bangladesh',
    page: 'manufacturing-partners',
    category: 'supplier',
    badge: 'Factory',
    keywords: ['manufacturing', 'oem', 'odm', 'production', 'mills', 'textile factories'],
    icon: Building2,
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-50 dark:bg-teal-950/40',
  },

  // 3. Deals, Clearance & Promotions
  {
    id: 'dest-wholesale-deals',
    title: 'Wholesale Deals & Flash Sales',
    subtitle: 'Exclusive tiered bulk discounts and limited-time volume pricing',
    page: 'deals',
    category: 'page',
    badge: 'Hot Offers',
    keywords: ['deal', 'deals', 'discount', 'discounts', 'sale', 'sales', 'flash sale', 'promo', 'offers', 'cheap'],
    icon: BadgePercent,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-50 dark:bg-rose-950/40',
  },
  {
    id: 'dest-clearance',
    title: 'Clearance & Bulk Overstock',
    subtitle: 'Factory surplus and closeout inventory at liquidation prices',
    page: 'clearance',
    category: 'page',
    badge: 'Liquidation',
    keywords: ['clearance', 'surplus', 'overstock', 'liquidation', 'closeout', 'bargain'],
    icon: Tag,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-50 dark:bg-orange-950/40',
  },

  // 4. Categories & Departments
  {
    id: 'dest-categories-page',
    title: 'All Product Categories',
    subtitle: 'Browse all 8 wholesale departments and industrial categories',
    page: 'categories-page',
    category: 'page',
    badge: 'Taxonomy',
    keywords: ['category', 'categories', 'departments', 'sections', 'browse', 'catalog', 'textiles', 'agriculture', 'electronics'],
    icon: Layers,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50 dark:bg-violet-950/40',
  },

  // 5. Support, Help & Disputes
  {
    id: 'dest-support-center',
    title: 'Support Center & Helpdesk',
    subtitle: 'Get 24/7 dedicated assistance for wholesale transactions',
    page: 'support-center',
    category: 'support',
    badge: '24/7 Help',
    keywords: ['help', 'support', 'contact', 'customer care', 'helpdesk', 'assistance', 'phone', 'email', 'agent'],
    icon: HelpCircle,
    iconColor: 'text-sky-600',
    iconBg: 'bg-sky-50 dark:bg-sky-950/40',
  },
  {
    id: 'dest-support-tickets',
    title: 'Support Tickets & Inquiries',
    subtitle: 'View and reply to active support tickets or open a new case',
    page: 'support-tickets',
    category: 'support',
    badge: 'Tickets',
    keywords: ['ticket', 'tickets', 'complaint', 'issue', 'open ticket', 'case', 'problem'],
    icon: MessageSquare,
    iconColor: 'text-cyan-600',
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/40',
  },
  {
    id: 'dest-raise-dispute',
    title: 'Dispute Resolution Center',
    subtitle: 'Escalate order issues, non-delivery, or spec mismatches',
    page: 'raise-dispute',
    category: 'support',
    badge: 'Disputes',
    keywords: ['dispute', 'disputes', 'refund', 'complaint', 'claim', 'mediation', 'arbitration'],
    icon: ShieldCheck,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50 dark:bg-red-950/40',
  },

  // 6. Buyer Finance & Wallet
  {
    id: 'dest-buyer-wallet',
    title: 'Buyer Wallet & Balance',
    subtitle: 'Manage BDT wallet funds, transaction history, and bulk payouts',
    page: 'wallet-page',
    category: 'finance',
    badge: 'Finance',
    keywords: ['wallet', 'balance', 'funds', 'top up', 'deposit', 'payout', 'money', 'payment methods'],
    icon: Wallet,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    id: 'dest-trade-assurance',
    title: 'Trade Assurance & Protection',
    subtitle: 'Safe escrow payments and quality guarantees for bulk buyers',
    page: 'trade-assurance',
    category: 'tool',
    badge: 'Escrow',
    keywords: ['trade assurance', 'escrow', 'protection', 'guarantee', 'safe payment', 'trust', 'verified'],
    icon: ShieldCheck,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50 dark:bg-green-950/40',
  },

  // 7. Seller Hub & Vendor Registration
  {
    id: 'dest-seller-center',
    title: 'Seller Center & Portal',
    subtitle: 'Manage supplier listings, inventory, bulk RFQs, and sales',
    page: 'seller-dashboard-page',
    category: 'page',
    badge: 'For Sellers',
    keywords: ['seller', 'vendor portal', 'merchant', 'seller center', 'supplier dashboard', 'inventory management'],
    icon: Store,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50 dark:bg-purple-950/40',
  },
  {
    id: 'dest-become-a-seller',
    title: 'Become a Verified Supplier',
    subtitle: 'Register your factory or wholesale business on Zylod',
    page: 'become-a-seller',
    category: 'page',
    badge: 'Join Us',
    keywords: ['sell with us', 'become a seller', 'register seller', 'vendor registration', 'sell wholesale', 'open store'],
    icon: Building2,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
  },

  // 8. Blog & Industry News
  {
    id: 'dest-blog',
    title: 'Wholesale Market News & Insights',
    subtitle: 'Market trends, export policies, and supply chain updates',
    page: 'blog',
    category: 'page',
    badge: 'Articles',
    keywords: ['blog', 'news', 'articles', 'insights', 'market trends', 'reports', 'updates'],
    icon: FileText,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/5 dark:bg-primary/10',
  },
]

// Shape of a supplier row returned by GET /api/suppliers
export interface SupplierSearchHit {
  id: string
  companyName: string
  ratingAvg: number | null
  city?: string
  productCount?: number
  verificationStatus?: string
}

const QUICK_SHORTCUTS = [
  { label: 'Track Order', page: 'order-tracking', icon: PackageCheck },
  { label: 'Suppliers', page: 'suppliers', icon: Building2 },
  { label: 'Deals & Sales', page: 'deals', icon: BadgePercent },
  { label: 'RFQ Quotes', page: 'rfq-list', icon: Sliders },
  { label: 'Support Center', page: 'support-center', icon: HelpCircle },
  { label: 'Buyer Wallet', page: 'wallet-page', icon: Wallet },
]

export function HeaderInternalSearch() {
  const { navigate } = useNavigationStore()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [mobileModalOpen, setMobileModalOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  // Load recent internal searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_INTERNAL_SEARCHES_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 5))
        }
      }
    } catch {}
  }, [])

  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((i) => i.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5)
      try {
        localStorage.setItem(RECENT_INTERNAL_SEARCHES_KEY, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  const clearRecentSearches = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setRecentSearches([])
    try {
      localStorage.removeItem(RECENT_INTERNAL_SEARCHES_KEY)
    } catch {}
  }, [])

  // Match internal destinations based on natural language keywords & titles
  const matchingDestinations = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    return INTERNAL_DIRECTORY.filter((item) => {
      if (item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)) return true
      if (item.keywords.some((k) => k.includes(q) || q.includes(k))) return true
      return false
    }).slice(0, 5)
  }, [query])

  // Live supplier search against the real suppliers API (debounced)
  const [matchingSuppliers, setMatchingSuppliers] = useState<SupplierSearchHit[]>([])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setMatchingSuppliers([])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/suppliers?verificationStatus=approved&sort=rating&limit=3&search=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        )
        const json = await res.json()
        setMatchingSuppliers(res.ok && json.success && Array.isArray(json.data) ? json.data : [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setMatchingSuppliers([])
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  // Combined selectable items for keyboard navigation
  const selectableItems = useMemo(() => {
    return [
      ...matchingDestinations.map((d) => ({ type: 'destination' as const, data: d })),
      ...matchingSuppliers.map((s) => ({ type: 'supplier' as const, data: s })),
    ]
  }, [matchingDestinations, matchingSuppliers])

  // Close desktop dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus mobile input when mobile modal opens
  useEffect(() => {
    if (mobileModalOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 80)
    }
  }, [mobileModalOpen])

  // Intelligent submission: Priority given to internal stuff
  const executeInternalSearch = useCallback(
    (searchRaw: string) => {
      const trimmed = searchRaw.trim()
      if (!trimmed) return

      saveRecentSearch(trimmed)
      setIsOpen(false)
      setMobileModalOpen(false)
      setActiveIndex(-1)

      const lower = trimmed.toLowerCase()

      // 1. Check if first matching internal destination is a high-confidence match
      const firstMatch = INTERNAL_DIRECTORY.find((item) =>
        item.keywords.some((k) => lower.includes(k) || k.includes(lower))
      )

      if (firstMatch) {
        navigate(firstMatch.page, firstMatch.params || { query: trimmed })
        return
      }

      // 2. Check supplier match against the live API results
      const supplierMatch = matchingSuppliers.find((s) => s.companyName.toLowerCase().includes(lower))
      if (supplierMatch) {
        navigate('suppliers', { query: supplierMatch.companyName })
        return
      }
      if (lower.includes('supplier') || lower.includes('vendor')) {
        navigate('suppliers', { query: trimmed })
        return
      }

      // 3. Fallback: global search
      navigate('search-results', { query: trimmed })
    },
    [navigate, saveRecentSearch, matchingSuppliers]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (activeIndex >= 0 && selectableItems[activeIndex]) {
      const selected = selectableItems[activeIndex]
      if (selected.type === 'destination') {
        saveRecentSearch(selected.data.title)
        setIsOpen(false)
        setMobileModalOpen(false)
        navigate(selected.data.page, selected.data.params)
        return
      }
      if (selected.type === 'supplier') {
        saveRecentSearch(selected.data.companyName)
        setIsOpen(false)
        setMobileModalOpen(false)
        navigate('suppliers', { query: selected.data.companyName })
        return
      }
    }
    executeInternalSearch(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && !mobileModalOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < selectableItems.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > -1 ? prev - 1 : -1))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setMobileModalOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <>
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. MOBILE TRIGGER BUTTON (< lg)                            */}
      {/* ────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setMobileModalOpen(true)}
        aria-label="Search site, internal tools and suppliers"
        className="lg:hidden flex items-center justify-center h-9 w-9 rounded-full text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. DESKTOP SEARCH PILL & DROPDOWN (lg+)                    */}
      {/* ────────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative hidden lg:flex items-center mr-1">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            name="q"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
              setActiveIndex(-1)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search internal pages, suppliers, tools..."
            aria-label="Search internal site navigation and suppliers"
            className="w-[220px] lg:w-[200px] xl:w-[260px] 2xl:w-[360px] h-9 pl-9 pr-24 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-[13px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 focus:bg-white dark:focus:bg-gray-900 transition-all"
          />

          {/* Clear + Multimodal Scan Icons */}
          <div className="absolute right-2 flex items-center gap-0.5 text-gray-400">
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setIsOpen(true)
                  inputRef.current?.focus()
                }}
                title="Clear"
                aria-label="Clear"
                className="p-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('image-search')}
              title="Photo Scan"
              aria-label="Photo Scan"
              className="p-1 hover:text-[#E31C3D] transition-colors"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => navigate('barcode-scanner')}
              title="QR Code Scan"
              aria-label="QR Code Scan"
              className="p-1 hover:text-[#E31C3D] transition-colors"
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => navigate('voice-search')}
              title="Voice Search"
              aria-label="Voice Search"
              className="p-1 hover:text-[#E31C3D] transition-colors"
            >
              <Mic className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>

        {/* Floating Dropdown: Prioritizes Internal Stuff */}
        {isOpen && (
          <div className="absolute top-[calc(100%+8px)] right-0 w-[420px] max-w-[calc(100vw-32px)] z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.16)] border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Render Suggestions Content */}
            <SuggestionsContent
              query={query}
              matchingDestinations={matchingDestinations}
              matchingSuppliers={matchingSuppliers}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              recentSearches={recentSearches}
              onSelectDestination={(dest) => {
                saveRecentSearch(dest.title)
                setIsOpen(false)
                navigate(dest.page, dest.params)
              }}
              onSelectSupplier={(supplier) => {
                saveRecentSearch(supplier.companyName)
                setIsOpen(false)
                navigate('suppliers', { query: supplier.companyName })
              }}
              onExecuteSearch={(term) => {
                setQuery(term)
                executeInternalSearch(term)
              }}
              onClearRecent={clearRecentSearches}
            />
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. RESPONSIVE MOBILE / TABLET SEARCH OVERLAY (< lg)        */}
      {/* ────────────────────────────────────────────────────────── */}
      {mobileModalOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 w-full rounded-b-2xl shadow-2xl border-b border-gray-200 dark:border-gray-800 p-3 sm:p-4 max-h-[85vh] flex flex-col">
            {/* Header: Input Bar + Close */}
            <div className="flex items-center gap-2 mb-3">
              <form onSubmit={handleSubmit} className="relative flex-1 flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  ref={mobileInputRef}
                  name="q_mobile"
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActiveIndex(-1)
                  }}
                  placeholder="Search internal pages, suppliers, tools..."
                  aria-label="Search internal site navigation and suppliers"
                  className="w-full h-10 pl-9 pr-24 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 focus:bg-white dark:focus:bg-gray-900"
                />

                <div className="absolute right-2.5 flex items-center gap-1 text-gray-400">
                  {query.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="p-1 hover:text-gray-700 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileModalOpen(false)
                      navigate('image-search')
                    }}
                    className="p-1 hover:text-[#E31C3D]"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileModalOpen(false)
                      navigate('barcode-scanner')
                    }}
                    className="p-1 hover:text-[#E31C3D]"
                  >
                    <QrCode className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileModalOpen(false)
                      navigate('voice-search')
                    }}
                    className="p-1 hover:text-[#E31C3D]"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                </div>
              </form>

              <button
                type="button"
                onClick={() => setMobileModalOpen(false)}
                className="h-10 px-3 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white shrink-0"
              >
                Cancel
              </button>
            </div>

            {/* Scrollable Suggestions for Mobile */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              <SuggestionsContent
                query={query}
                matchingDestinations={matchingDestinations}
                matchingSuppliers={matchingSuppliers}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                recentSearches={recentSearches}
                onSelectDestination={(dest) => {
                  saveRecentSearch(dest.title)
                  setMobileModalOpen(false)
                  navigate(dest.page, dest.params)
                }}
                onSelectSupplier={(supplier) => {
                  saveRecentSearch(supplier.companyName)
                  setMobileModalOpen(false)
                  navigate('suppliers', { query: supplier.companyName })
                }}
                onExecuteSearch={(term) => {
                  setQuery(term)
                  executeInternalSearch(term)
                }}
                onClearRecent={clearRecentSearches}
              />
            </div>
          </div>

          {/* Backdrop Dismiss */}
          <div className="flex-1" onClick={() => setMobileModalOpen(false)} />
        </div>
      )}
    </>
  )
}

/** Reusable Suggestions & Zero-State Content */
function SuggestionsContent({
  query,
  matchingDestinations,
  matchingSuppliers,
  activeIndex,
  setActiveIndex,
  recentSearches,
  onSelectDestination,
  onSelectSupplier,
  onExecuteSearch,
  onClearRecent,
}: {
  query: string
  matchingDestinations: InternalDestination[]
  matchingSuppliers: SupplierSearchHit[]
  activeIndex: number
  setActiveIndex: (idx: number) => void
  recentSearches: string[]
  onSelectDestination: (dest: InternalDestination) => void
  onSelectSupplier: (supplier: SupplierSearchHit) => void
  onExecuteSearch: (term: string) => void
  onClearRecent: (e: React.MouseEvent) => void
}) {
  return query.trim().length > 0 ? (
    <div className="p-2 space-y-2">
      {/* 1. Internal Destinations (Top Priority) */}
      {matchingDestinations.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2.5 py-1 mb-1 border-b border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-rose-500" />
              Internal Destinations & Tools
            </span>
            <span className="text-[10px] font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
              Priority
            </span>
          </div>

          <div className="space-y-0.5">
            {matchingDestinations.map((item, idx) => {
              const Icon = item.icon
              const isActive = activeIndex === idx
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectDestination(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-rose-50/80 dark:bg-rose-950/30 ring-1 ring-rose-200 dark:ring-rose-900/50'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-4 w-4 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100 truncate">{item.title}</p>
                      {item.badge && (
                        <span className="text-[9.5px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{item.subtitle}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. Suppliers Section */}
      {matchingSuppliers.length > 0 && (
        <div>
          <div className="px-2.5 py-1 mb-1 border-b border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-emerald-500" />
              Verified Suppliers
            </span>
          </div>

          <div className="space-y-0.5">
            {matchingSuppliers.map((supplier, sIdx) => {
              const itemIdx = matchingDestinations.length + sIdx
              const isActive = activeIndex === itemIdx
              return (
                <button
                  key={supplier.id}
                  type="button"
                  onClick={() => onSelectSupplier(supplier)}
                  onMouseEnter={() => setActiveIndex(itemIdx)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-rose-50/80 dark:bg-rose-950/30 ring-1 ring-rose-200 dark:ring-rose-900/50'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100 truncate">{supplier.companyName}</p>
                      {(supplier.ratingAvg ?? 0) > 0 ? (
                        <span className="text-[9.5px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded">
                          Verified ★ {supplier.ratingAvg!.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {[supplier.city, typeof supplier.productCount === 'number' ? `${supplier.productCount} products` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Verified supplier'}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* No internal matches found */}
      {matchingDestinations.length === 0 && matchingSuppliers.length === 0 && (
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-gray-500">
            No internal tools or pages directly matching &quot;
            <span className="font-semibold text-gray-800 dark:text-gray-200">{query}</span>&quot;
          </p>
        </div>
      )}

      {/* Secondary Product Search Link (Lower priority, clear fallback) */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 px-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onExecuteSearch(query)}
          className="text-xs font-semibold text-gray-500 hover:text-[#E31C3D] flex items-center gap-1 py-1 transition-colors"
        >
          <span>Looking for products instead? Search catalog for &quot;{query}&quot;</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  ) : (
    /* STATE B: Empty Input Zero-State (Shortcuts & Quick Access) */
    <div className="p-3 space-y-2.5">
      {/* Quick Navigation Shortcuts */}
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1.5">
          <Sparkles className="h-3 w-3 text-rose-500" />
          Quick Internal Shortcuts
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_SHORTCUTS.map((sc) => {
            const ScIcon = sc.icon
            return (
              <button
                key={sc.label}
                type="button"
                onClick={() => onExecuteSearch(sc.label)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left border border-gray-100 dark:border-gray-700/60 transition-colors group"
              >
                <ScIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-[#E31C3D] shrink-0" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white truncate">
                  {sc.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent Internal Searches */}
      {recentSearches.length > 0 && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Recent Searches
            </span>
            <button
              type="button"
              onClick={onClearRecent}
              className="text-[10.5px] text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onExecuteSearch(term)}
                className="px-2.5 py-0.5 bg-gray-50 dark:bg-gray-800 hover:bg-rose-50 hover:text-[#E31C3D] rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
