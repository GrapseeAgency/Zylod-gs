'use client'

import { useNavigationStore } from '@/store/navigation-store'
import { Scissors, Globe, Clock, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

const PROMO_FEATURES = [
  { icon: Scissors, title: 'Daily Deals', color: 'text-primary', bg: 'bg-primary/10', desc: 'Bulk discounts', page: 'daily-deals' as const },
  { icon: Globe, title: 'Cross-border', color: 'text-blue-600', bg: 'bg-blue-50', desc: 'International sourcing', page: 'cross-border' as const },
  { icon: Clock, title: 'Flash Sale', color: 'text-primary', bg: 'bg-primary/10', desc: 'Limited time offers', page: 'flash-sale' as const },
  { icon: Zap, title: 'Factory Direct', color: 'text-primary', bg: 'bg-primary/10', desc: 'Direct from manufacturers', page: 'factory-direct' as const },
]

export function MobilePromoFeatures() {
  const { navigate } = useNavigationStore()

  return (
    <section className="mt-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="grid grid-cols-2 gap-2.5"
      >
        {PROMO_FEATURES.map((feature, i) => {
          const IconComp = feature.icon
          return (
            <button
              key={i}
              onClick={() => navigate(feature.page)}
              className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-2.5 transition-all active:scale-[0.97] hover:shadow-sm text-left"
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${feature.bg}`}>
                <IconComp className={`h-4.5 w-4.5 ${feature.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold ${feature.color}`}>{feature.title}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{feature.desc}</p>
              </div>
            </button>
          )
        })}
      </motion.div>
    </section>
  )
}
