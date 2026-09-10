'use client'

import { useAuthStore } from '@/store/auth-store'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

export function VerificationBanner() {
  const { user } = useAuthStore()
  const { navigate } = useNavigationStore()
  const [dismissed, setDismissed] = useState(false)

  if (!user || dismissed) return null

  // Buyer with incomplete profile
  if (user.userType === 'buyer' && !user.isProfileComplete) {
    return (
      <div className="bg-warning/10 border-b border-warning/20 px-4 py-3">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm">
              <span className="font-medium">Complete your verification</span> to place orders and start chatting with suppliers.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => navigate('profile')} className="bg-warning text-warning-foreground hover:bg-warning/90">
              Complete Profile
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Supplier with pending/rejected verification
  if (user.userType === 'supplier' && user.verificationStatus && user.verificationStatus !== 'approved') {
    const statusText = user.verificationStatus === 'rejected'
      ? `Verification rejected: ${user.rejectionReason || 'Contact support for details'}.`
      : 'Your supplier verification is under review. You cannot list products until approved.'

    return (
      <div className="bg-warning/10 border-b border-warning/20 px-4 py-3">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-warning shrink-0" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span>
            <p className="text-sm">
              <span className="font-medium">{statusText}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => navigate('supplier-verification-status')}>
              View Status
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
