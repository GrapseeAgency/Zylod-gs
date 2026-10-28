'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { SellerProfilePage } from './seller-profile-page'
import { AdminProfilePage } from './admin-profile-page'
import { StaffProfilePage } from './staff-profile-page'
import { BuyerProfilePage } from './buyer-profile-page'
import { AccountGate } from '@/components/shared/account-gate'

export function ProfilePage() {
  const { user, token, isAuthenticated } = useAuthStore()
  const { pageParams } = useNavigationStore()

  // Real user role: 'supplier' | 'buyer' | 'staff' | 'admin'
  const [role, setRole] = useState<'supplier' | 'buyer' | 'staff' | 'admin'>(
    (pageParams?.role as any) || (user?.userType as any) || 'buyer'
  )
  const [loading, setLoading] = useState(!user)
  // Honesty fix: deep links can mount before the boot session probe settles —
  // wait briefly before showing the sign-in gate so a restored session is not
  // mistaken for a guest.
  const [gateReady, setGateReady] = useState(false)

  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setGateReady(true), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    async function loadData() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/profile/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (res.ok && json.data && json.data.userType) {
          // If pageParams doesn't explicitly request another role/view, set to authentic userType
          if (!pageParams?.role) {
            setRole(json.data.userType)
          }
        }
      } catch {
        // Graceful fallback to user state
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [token, pageParams?.role])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <PageLoader label="Loading Profile…" className="min-h-0" />
      </div>
    )
  }

  if (!isAuthenticated && gateReady) {
    return (
      <AccountGate
        title="Sign in to view your profile"
        message="Your profile shows your real account details. Sign in to continue."
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        <motion.div
          key={role}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {role === 'supplier' && <SellerProfilePage />}
          {role === 'admin' && <AdminProfilePage />}
          {role === 'staff' && <StaffProfilePage />}
          {role === 'buyer' && <BuyerProfilePage />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default ProfilePage
import { PageLoader } from '@/components/ui/page-loader'
