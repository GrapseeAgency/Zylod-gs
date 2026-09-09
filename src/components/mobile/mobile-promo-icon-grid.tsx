'use client'

import { useNavigationStore } from '@/store/navigation-store'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Clock, Globe, Scissors, Store, Shield,
  Truck, Award, CreditCard, Package, BadgePercent, TrendingUp,
  Factory, Banknote, Headphones, Compass, Sparkles, Tag, Building2, LayoutGrid,
  X,
} from 'lucide-react'

/* ─── Quick Access entries — every target is a registered page ─── */
interface QuickLink {
  icon: typeof Zap
  label: string
  color: string
  bg: string
  page: string
}

const PRIMARY_LINKS: QuickLink[] = [
  { icon: Compass, label: 'Explore', color: '#C8102E', bg: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', page: 'explore' },
  { icon: TrendingUp, label: 'Trending', color: '#E53935', bg: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', page: 'trending-products' },
  { icon: Zap, label: 'Flash Sale', color: '#F57C00', bg: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)', page: 'flash-sale' },
  { icon: Scissors, label: 'Daily Deals', color: '#E53935', bg: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', page: 'daily-deals' },
  { icon: Sparkles, label: 'New Arrivals', color: '#1565C0', bg: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', page: 'new-arrivals' },
  { icon: Tag, label: 'Clearance', color: '#C62828', bg: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', page: 'clearance' },
  { icon: Award, label: 'Seasonal', color: '#2E7D32', bg: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)', page: 'seasonal-offers' },
  { icon: Building2, label: 'Brands', color: '#6A1B9A', bg: 'linear-gradient(135deg, #F3E5F5, #E1BEE7)', page: 'brand-showcase' },
]

const MORE_LINKS: QuickLink[] = [
  { icon: LayoutGrid, label: 'Categories', color: '#1976D2', bg: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', page: 'category-browser' },
  { icon: BadgePercent, label: 'Coupons', color: '#C62828', bg: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', page: 'coupons' },
  { icon: Store, label: 'Suppliers', color: '#E53935', bg: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', page: 'suppliers' },
  { icon: Shield, label: 'Trade Assurance', color: '#1976D2', bg: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', page: 'suppliers' },
  { icon: CreditCard, label: 'Easy Payments', color: '#388E3C', bg: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)', page: 'checkout' },
  { icon: Truck, label: 'Fast Shipping', color: '#6A1B9A', bg: 'linear-gradient(135deg, #F3E5F5, #E1BEE7)', page: 'orders' },
  { icon: Clock, label: 'Top Deals', color: '#F57C00', bg: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)', page: 'top-deals' },
  { icon: Package, label: 'Bulk Orders', color: '#00695C', bg: 'linear-gradient(135deg, #E0F2F1, #B2DFDB)', page: 'bulk-order' },
  { icon: Banknote, label: 'RFQ', color: '#37474F', bg: 'linear-gradient(135deg, #ECEFF1, #CFD8DC)', page: 'rfq-list' },
  { icon: Headphones, label: 'Support', color: '#C8102E', bg: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', page: 'support' },
  { icon: Globe, label: 'Cross-border', color: '#1976D2', bg: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', page: 'cross-border' },
  { icon: Factory, label: 'Factory Direct', color: '#388E3C', bg: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)', page: 'factory-direct' },
]

function QuickIcon({ item, onClick }: { item: QuickLink; onClick: () => void }) {
  const IconComp = item.icon
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] active:scale-95 transition-transform"
    >
      <div
        className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm"
        style={{ background: item.bg }}
      >
        <IconComp className="h-5 w-5" style={{ color: item.color }} />
      </div>
      <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-1 w-full">
        {item.label}
      </span>
    </button>
  )
}

export function MobilePromoIconGrid() {
  const { navigate } = useNavigationStore()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <section className="mt-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="bg-card rounded-xl border border-border/50 p-3"
      >
        {/* Section header */}
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-semibold text-foreground">Quick Access</h3>
          <button
            onClick={() => setMoreOpen(true)}
            className="text-[10px] text-primary font-medium active:scale-95 transition-transform"
          >
            More
          </button>
        </div>

        {/* Single horizontal scroll row */}
        <div className="-mx-3 px-3">
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x">
            {PRIMARY_LINKS.map((item) => (
              <div key={item.label} className="snap-start">
                <QuickIcon item={item} onClick={() => navigate(item.page as never)} />
              </div>
            ))}
            {/* Inline More trigger at the end of the row */}
            <div className="snap-start">
              <button
                onClick={() => setMoreOpen(true)}
                className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] active:scale-95 transition-transform"
              >
                <div className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm bg-muted">
                  <span className="text-[10px] font-black text-muted-foreground">+{MORE_LINKS.length}</span>
                </div>
                <span className="text-[10px] font-medium text-foreground leading-tight">More</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── More Sheet ─── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/50"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[71] bg-card rounded-t-3xl max-h-[75vh] overflow-y-auto pb-[calc(24px+env(safe-area-inset-bottom))]"
            >
              {/* Sheet handle + header */}
              <div className="sticky top-0 bg-card rounded-t-3xl pt-3 pb-2 px-4 border-b border-border/40">
                <div className="w-10 h-1 rounded-full bg-border mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">All Services</h3>
                  <button
                    onClick={() => setMoreOpen(false)}
                    className="p-1.5 rounded-full hover:bg-muted active:scale-95 transition-all"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Grid inside sheet — 4 columns for scanability */}
              <div className="grid grid-cols-4 gap-y-4 px-4 py-4">
                {MORE_LINKS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setMoreOpen(false)
                      navigate(item.page as never)
                    }}
                    className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <div
                      className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm"
                      style={{ background: item.bg }}
                    >
                      <item.icon className="h-5 w-5" style={{ color: item.color }} />
                    </div>
                    <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-2">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  )
}
