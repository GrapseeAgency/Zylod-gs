'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Eye, Shield, Lock, Globe, Building2,
  Mail, Phone, Loader2, AlertCircle, Check, Users, UserX
} from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'

type ProfileVisibility = 'public' | 'buyers' | 'private'

/**
 * Real privacy settings, persisted on the userSettings row via
 * GET/PATCH /api/profile/privacy (cookies, credentials:'include').
 *
 * REAL controls (backed by schema columns):
 *  - profileVisibility: 'public' | 'buyers' | 'private'
 *  - showEmail / showPhone switches
 *
 * The previous six fabricated toggles are gone: three are replaced by the
 * real controls above; the rest (RFQ/chat gating, data sharing, search-engine
 * indexing, analytics) have no backend backing and are shown as honestly not
 * implemented. The old "data archive" button downloaded a fabricated JSON
 * file — a data-export feature does not exist and is no longer faked.
 * No optimistic writes: every change PATCHes first, applies on 2xx, and
 * reverts with the verbatim server error otherwise.
 */
export function PrivacySettingsPage() {
  const { navigate, goBack } = useNavigationStore()

  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>('public')
  const [showEmail, setShowEmail] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [configured, setConfigured] = useState(false)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const serverStateRef = useRef<{ profileVisibility: ProfileVisibility; showEmail: boolean; showPhone: boolean }>({
    profileVisibility: 'public',
    showEmail: false,
    showPhone: false,
  })

  useEffect(() => {
    async function loadPrivacy() {
      setLoading(true)
      setLoadError('')
      setNeedsAuth(false)
      try {
        const res = await fetch('/api/profile/privacy', { credentials: 'include' })
        if (res.status === 401 || res.status === 403) {
          setNeedsAuth(true)
          return
        }
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          setLoadError(json?.error || `Failed to load your privacy settings (HTTP ${res.status}).`)
          return
        }
        const visibility: ProfileVisibility =
          json.data?.profileVisibility === 'buyers' ? 'buyers'
          : json.data?.profileVisibility === 'private' ? 'private'
          : 'public'
        const state = {
          profileVisibility: visibility,
          showEmail: Boolean(json.data?.showEmail),
          showPhone: Boolean(json.data?.showPhone),
        }
        serverStateRef.current = state
        setProfileVisibility(state.profileVisibility)
        setShowEmail(state.showEmail)
        setShowPhone(state.showPhone)
        setConfigured(Boolean(json.data?.configured))
      } catch {
        setLoadError('Network error while loading your privacy settings. Check your connection and retry.')
      } finally {
        setLoading(false)
      }
    }
    loadPrivacy()
  }, [])

  const patchPrivacy = async (patch: {
    profileVisibility?: ProfileVisibility
    showEmail?: boolean
    showPhone?: boolean
  }) => {
    if (saving || Object.keys(patch).length === 0) return
    setSaveError('')
    setSaving(true)
    try {
      const res = await fetch('/api/profile/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        setSaveError(json?.error || 'Your session ended — sign in to save your privacy settings.')
        return
      }
      if (!res.ok || !json?.success) {
        setSaveError(json?.error || `Saving your privacy settings failed (HTTP ${res.status}).`)
        return
      }
      // Server-confirmed state only — never optimistic.
      const state = {
        profileVisibility: (json.data?.profileVisibility === 'buyers' ? 'buyers' : json.data?.profileVisibility === 'private' ? 'private' : 'public') as ProfileVisibility,
        showEmail: Boolean(json.data?.showEmail),
        showPhone: Boolean(json.data?.showPhone),
      }
      serverStateRef.current = state
      setProfileVisibility(state.profileVisibility)
      setShowEmail(state.showEmail)
      setShowPhone(state.showPhone)
      setConfigured(true)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
    } catch {
      setSaveError('Network error while saving your privacy settings. Check your connection and retry.')
    } finally {
      setSaving(false)
    }
  }

  const revertToLocalServerState = () => {
    setProfileVisibility(serverStateRef.current.profileVisibility)
    setShowEmail(serverStateRef.current.showEmail)
    setShowPhone(serverStateRef.current.showPhone)
  }

  const visibilityOptions: { key: ProfileVisibility; label: string; desc: string; icon: React.ElementType }[] = [
    { key: 'public', label: 'Public', desc: 'Any visitor can see your basic business profile in the wholesale directory.', icon: Globe },
    { key: 'buyers', label: 'Verified buyers only', desc: 'Only signed-in buyers can view your business profile.', icon: Users },
    { key: 'private', label: 'Private', desc: 'Your business profile is hidden from the directory entirely.', icon: UserX },
  ]

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 pb-24 md:pb-10">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Privacy &amp; Data Controls</span>
        <button
          onClick={() => navigate('account-settings')}
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          title="Settings"
        >
          <Shield className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-3xl md:px-6 md:py-8 md:space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Privacy &amp; Data Controls</h1>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            onClick={() => navigate('account-settings')}
          >
            <Shield className="h-4 w-4 mr-2" />
            Account Settings
          </Button>
        </div>
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-slate-900 dark:to-rose-950 rounded-3xl p-5 md:p-7 text-gray-900 dark:text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black/5 dark:bg-gray-900/10 border border-black/10 dark:border-white/20 flex items-center justify-center">
              <Eye className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-black">Privacy Settings</h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Control who can see your business profile and contact details. Changes save to your account immediately.
              </p>
            </div>
          </div>
        </div>

        {needsAuth ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xs text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
            <h2 className="text-sm font-black">Sign in to manage your privacy settings</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Privacy preferences are stored on your account.</p>
            <Button onClick={() => navigate('login')} className="h-11 px-6 rounded-xl text-xs font-bold">Sign In</Button>
          </div>
        ) : (
          <>
            {/* Real load error */}
            {loadError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600">{loadError}</p>
              </div>
            )}

            {/* Profile Visibility */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-background border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Profile Visibility</span>
                </div>
                {!loading && (
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400">
                    {configured ? 'Customized for your account' : 'Platform default — not customized yet'}
                  </span>
                )}
              </div>

              {loading ? (
                <PageLoader label="Loading your privacy settings…" />
              ) : (
                <div className="p-4 grid grid-cols-1 gap-2">
                  {visibilityOptions.map(({ key, label, desc, icon: Icon }) => {
                    const isSelected = profileVisibility === key
                    return (
                      <button
                        key={key}
                        onClick={() => { if (!isSelected) { revertToLocalServerState(); patchPrivacy({ profileVisibility: key }) } }}
                        disabled={saving}
                        className={`p-3.5 rounded-2xl border text-left transition-all disabled:opacity-70 ${
                          isSelected
                            ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-rose-50 border border-rose-100 text-primary' : 'bg-slate-100 dark:bg-card border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`text-xs font-bold block ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-slate-100'}`}>{label}</span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 block mt-0.5">{desc}</span>
                          </div>
                          {isSelected && (
                            saving ? <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" /> : <Check className="h-4 w-4 text-primary stroke-[3] shrink-0" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Contact visibility — real switches */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-background border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Contact Details on Your Profile</span>
              </div>

              <div className="divide-y divide-slate-50">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Show my email address</h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Display your email on your business profile.</p>
                    </div>
                  </div>
                  <Switch
                    checked={showEmail}
                    disabled={saving || loading}
                    onCheckedChange={(val) => { if (val !== showEmail) { revertToLocalServerState(); patchPrivacy({ showEmail: val }) } }}
                    className="data-[state=checked]:bg-primary shrink-0"
                    aria-label="Show my email address"
                  />
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Show my phone number</h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Display your phone on your business profile.</p>
                    </div>
                  </div>
                  <Switch
                    checked={showPhone}
                    disabled={saving || loading}
                    onCheckedChange={(val) => { if (val !== showPhone) { revertToLocalServerState(); patchPrivacy({ showPhone: val }) } }}
                    className="data-[state=checked]:bg-primary shrink-0"
                    aria-label="Show my phone number"
                  />
                </div>
              </div>
            </div>

            {/* Real save error — verbatim from the server */}
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600">{saveError}</p>
              </div>
            )}
            {savedFlash && !saveError && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-emerald-700">Privacy settings saved to your account.</p>
              </div>
            )}

            {/* Honest limitation note */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">More Privacy Controls</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
                Additional controls (direct RFQ &amp; chat gating, aggregated trade-trend sharing, public
                search-engine indexing, and platform analytics opt-out) are <b>not implemented yet — they
                require backend support</b> and are not shown as active switches until they can really persist.
                A certified data-archive export does not exist yet either, so no download is offered here.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default PrivacySettingsPage
