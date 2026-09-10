'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { SellerProfilePage } from './seller-profile-page'
import { AdminProfilePage } from './admin-profile-page'
import { StaffProfilePage } from './staff-profile-page'
import { BuyerProfilePage } from './buyer-profile-page'
import { Loader2 } from 'lucide-react'

export function ProfilePage() {
  const { user, token } = useAuthStore()
  const { pageParams } = useNavigationStore()

  // Real user role: 'supplier' | 'buyer' | 'staff' | 'admin'
  const [role, setRole] = useState<'supplier' | 'buyer' | 'staff' | 'admin'>(
    (pageParams?.role as any) || (user?.userType as any) || 'buyer'
  )
  const [loading, setLoading] = useState(!user)

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold">Loading Profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
