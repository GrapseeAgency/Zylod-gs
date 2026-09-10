'use client'

import { ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useNavigationStore } from '@/store/navigation-store'
import { motion } from 'framer-motion'

export function MobileVerificationBanner() {
  const { isAuthenticated, user } = useAuthStore()
  const { navigate } = useNavigationStore()

  // Don't show if user is already verified
  if (isAuthenticated && user?.isProfileComplete) {
    return null
  }

  const handleClick = () => {
    if (isAuthenticated) {
      navigate('profile')
    } else {
      navigate('register-buyer')
    }
  }

  return (
    <section className="mt-3">
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        onClick={handleClick}
        className="w-full bg-primary p-4 rounded-xl shadow-sm flex items-center justify-between relative overflow-hidden group active:scale-[0.98] transition-transform"
      >
        <div className="z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary-foreground" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span>
          </div>
          <div className="text-left">
            <h2 className="text-primary-foreground font-semibold text-base">
              Verify Your Business
            </h2>
            <p className="text-primary-foreground/80 text-xs mt-0.5">
              Complete your profile to unlock bulk discounts.
            </p>
          </div>
        </div>
        <div className="z-10">
          <ChevronRight className="w-5 h-5 text-primary-foreground" />
        </div>
        {/* Abstract decorative shape */}
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
        <div className="absolute -left-8 -bottom-8 w-20 h-20 bg-white/5 rounded-full blur-xl" />
      </motion.button>
    </section>
  )
}
