'use client'

/**
 * Honest account gate — shown when a page that owns role-scoped REAL data is
 * opened by a visitor who cannot have that data (guest, or the wrong account
 * type). Replaces the dishonest alternative: rendering the page's zero-state
 * ("৳0 revenue", "0 points") as if it were the visitor's real data.
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { ArrowLeft, LogIn, Store, ShieldCheck, User } from 'lucide-react'

export function AccountGate({
  title,
  message,
  showBecomeSupplier = false,
}: {
  title: string
  message: string
  /** Offer seller registration — for tools that belong to supplier accounts. */
  showBecomeSupplier?: boolean
}) {
  const { navigate, goBack } = useNavigationStore()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const userType = useAuthStore(s => s.user?.userType) ?? null

  return (
    <div className="min-h-[60vh] bg-background flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-sm p-6 md:p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          {isAuthenticated ? (
            <ShieldCheck className="h-6 w-6 text-primary" />
          ) : (
            <LogIn className="h-6 w-6 text-primary" />
          )}
        </div>
        <div className="space-y-1.5">
          <h1 className="text-base md:text-lg font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
          {!isAuthenticated ? (
            <Button onClick={() => navigate('login')} className="h-10 px-5 font-bold text-xs rounded-xl">
              <LogIn className="h-4 w-4 mr-1.5" /> Sign In
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground border border-border rounded-full px-3 py-1.5">
              <User className="h-3.5 w-3.5" /> Signed in as {userType ? userType.charAt(0).toUpperCase() + userType.slice(1) : 'user'}
            </span>
          )}
          {isAuthenticated && showBecomeSupplier && (
            <Button
              onClick={() => navigate('seller-registration')}
              variant="outline"
              className="h-10 px-5 font-bold text-xs rounded-xl border-primary/40 text-primary hover:bg-primary/5"
            >
              <Store className="h-4 w-4 mr-1.5" /> Become a Supplier
            </Button>
          )}
        </div>

        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground pt-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Go back
        </button>
      </div>
    </div>
  )
}

export default AccountGate
