'use client'

import { useNavigationStore } from '@/store/navigation-store'
import { motion } from 'framer-motion'
import { ChevronRight, Store, BadgeCheck } from 'lucide-react'

export function MobileVerifiedBanner() {
  const { navigate } = useNavigationStore()

  return (
    <section className="mt-4">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="flex gap-2"
      >
        {/* Verified Suppliers card */}
        <button
          onClick={() => navigate('suppliers')}
          className="flex-1 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-3 flex items-center gap-2 border border-green-200/50 dark:border-green-800/30 active:scale-[0.98] transition-transform text-left"
        >
          <div className="h-9 w-9 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-green-600" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-green-700 dark:text-green-400">Verified Suppliers</p>
            <p className="text-[9px] text-green-600/70 dark:text-green-500/60">Verified & trade assured</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-green-500/50 shrink-0 ml-auto" />
        </button>

        {/* Trade Assurance card */}
        <button
          onClick={() => navigate('suppliers')}
          className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl p-3 flex items-center gap-2 border border-blue-200/50 dark:border-blue-800/30 active:scale-[0.98] transition-transform text-left"
        >
          <div className="h-9 w-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
            <BadgeCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">Trade Assurance</p>
            <p className="text-[9px] text-blue-600/70 dark:text-blue-500/60">Secure transactions</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-blue-500/50 shrink-0 ml-auto" />
        </button>
      </motion.div>
    </section>
  )
}
