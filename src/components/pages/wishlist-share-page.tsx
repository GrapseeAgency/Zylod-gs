'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Copy, RefreshCw, QrCode, Trash2, ShieldAlert } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import { toast } from 'sonner'

export function WishlistSharePage() {
  const { goBack } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()
  const [shareData, setShareData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({ allowAddToCart: true, showPrices: true })
  // Honesty fix: share settings belong to the signed-in account — guests get
  // an account gate instead of a fake "You haven't shared your wishlist yet".
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Deep links can mount before the boot session probe settles.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    fetchShareStatus()
  }, [isAuthenticated])

  // Gates — placed after every hook so all hooks always run.
  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session is no longer valid. Sign in again to manage wishlist sharing." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to manage wishlist sharing"
        message="Wishlist share links and view counts belong to your account. Sign in to continue."
      />
    )
  }
  if (loadError) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-3">
          <ShieldAlert className="h-8 w-8 mx-auto text-primary" />
          <h1 className="text-base font-bold text-foreground">Could not load sharing settings</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <button onClick={() => window.location.reload()} className="h-9 px-4 bg-primary text-white rounded-xl text-xs font-bold">
            Try again
          </button>
        </div>
      </div>
    )
  }

  async function fetchShareStatus() {
    try {
      const res = await fetch('/api/wishlist/share', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        return
      }
      if (!res.ok || !json?.success) {
        setLoadError(json?.error || `Could not load your share status (HTTP ${res.status}).`)
        return
      }
      if (json.data) {
        setShareData(json.data)
        setSettings({ allowAddToCart: json.data.allowAddToCart, showPrices: json.data.showPrices })
      }
    } catch {
      setLoadError('Network error while loading your share status. Check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }

  const createShareLink = async () => {
    try {
      const res = await fetch('/api/wishlist/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        return
      }
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Could not save the share link (HTTP ${res.status}).`)
        return
      }
      setShareData(json.data)
      toast.success(json.data.token ? 'Share link is live' : 'Sharing settings saved')
    } catch {
      toast.error('Network error while saving the share link. Check your connection and retry.')
    }
  }

  const revokeShareLink = async () => {
    if (!confirm('Are you sure you want to revoke this link? Anyone with the link will no longer be able to view your wishlist.')) return
    try {
      const res = await fetch('/api/wishlist/share', { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        return
      }
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Could not revoke the share link (HTTP ${res.status}).`)
        return
      }
      setShareData(null)
      toast.success('Share link revoked')
    } catch {
      toast.error('Network error while revoking the share link. Check your connection and retry.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 items-center justify-center">
        <PageLoader className="min-h-0" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-gray-900 border-b flex items-center px-4 h-14">
        <button onClick={goBack} className="p-2 -ml-2 mr-2 active:bg-gray-100 dark:bg-gray-900 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="font-semibold text-gray-900 dark:text-gray-100">Sharing Settings</h1>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Sharing Settings</h1>

      <main className="flex-1 p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border overflow-hidden"
        >
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-medium text-gray-900 dark:text-gray-100">Share Status</h2>
            {shareData ? (
              <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>
            ) : (
              <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 dark:text-gray-500 text-xs font-medium rounded-full">Not Shared</span>
            )}
          </div>
          
          <div className="p-4">
            {shareData ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 rounded-lg p-2 border">
                  <div className="flex-1 truncate text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 font-mono">
                    {`${window.location.origin}/shared?token=${shareData.token}`}
                  </div>
                  <button className="p-2 bg-white dark:bg-gray-900 rounded shadow-sm border active:bg-gray-50 dark:bg-gray-950" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/shared?token=${shareData.token}`)}>
                    <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                  </button>
                  <button className="p-2 bg-white dark:bg-gray-900 rounded shadow-sm border active:bg-gray-50 dark:bg-gray-950" onClick={createShareLink}>
                    <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                  </button>
                </div>

                <div className="flex justify-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-dashed">
                  <QrCode className="w-24 h-24 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{shareData.viewCount || 0}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      {shareData.lastViewedAt ? new Date(shareData.lastViewedAt).toLocaleDateString() : 'Never'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Last Viewed</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-4">You haven't shared your wishlist yet.</p>
                <button onClick={createShareLink} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Generate Share Link
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {shareData && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border overflow-hidden"
            >
              <div className="p-4 border-b">
                <h2 className="font-medium text-gray-900 dark:text-gray-100">Settings</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Allow adding to cart</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Viewers can add items to their cart</div>
                  </div>
                  <input type="checkbox" checked={settings.allowAddToCart} onChange={() => setSettings(s => ({ ...s, allowAddToCart: !s.allowAddToCart }))} className="toggle text-primary" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Show prices</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Display current prices to viewers</div>
                  </div>
                  <input type="checkbox" checked={settings.showPrices} onChange={() => setSettings(s => ({ ...s, showPrices: !s.showPrices }))} className="toggle text-primary" />
                </div>
                <button onClick={createShareLink} className="w-full mt-2 py-2 bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium active:bg-gray-200">
                  Save Changes
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-red-50 rounded-xl border border-red-100 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                  <ShieldAlert className="w-5 h-5" />
                  Danger Zone
                </div>
                <p className="text-xs text-red-600 mb-4">
                  Revoking the share link will immediately disable access for anyone who has the link.
                </p>
                <button 
                  onClick={revokeShareLink}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-gray-900 border border-red-200 text-red-600 rounded-lg text-sm font-medium active:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Revoke Share Link
                </button>
              </div>
            </motion.div>
          </>
        )}
      </main>
    </div>
  )
}

export default WishlistSharePage
import { PageLoader } from '@/components/ui/page-loader'
