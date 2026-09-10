'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useTheme } from 'next-themes'
import {
  Menu, User, Lock, Smartphone, Bell, Eye, Link as LinkIcon, Trash2,
  ChevronRight, ShieldCheck, Globe, Moon, Sun, Laptop2, Camera,
  CreditCard, Landmark, FileText, Archive, Hash, Settings, Shield,
  Activity, RefreshCw, AlertTriangle, CheckCircle2, Check, X, Loader2,
  ChevronDown, ChevronUp, Key, QrCode, Fingerprint, Edit3, Download,
  Layers, Building2, FileCheck2, HardHat, Zap, Mail, Phone, Star,
  Radio, Monitor, Tablet, Smartphone as Phone2, MapPin, Clock, Award,
  LogOut, ShoppingBag, ArrowLeft, Truck, Receipt, History as HistoryIcon
} from 'lucide-react'

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────
interface ActiveSession {
  id: string
  device: string
  browser: string
  location: string
  lastActive: string
  isCurrent: boolean
}

// ─── TOGGLE ROW COMPONENT ───────────────────────────────────────────────────
function ToggleRow({
  icon: Icon,
  label,
  sub,
  checked,
  onChange,
  disabled,
  badge,
}: {
  icon: React.ElementType
  label: string
  sub?: string
  checked: boolean
  onChange?: (val: boolean) => void
  disabled?: boolean
  badge?: string
}) {
  return (
    <div className={`flex items-center justify-between py-4 px-5 border-b border-slate-50 last:border-0 ${disabled ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900">{label}</h3>
            {badge && (
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="data-[state=checked]:bg-primary shrink-0 ml-3"
      />
    </div>
  )
}

// ─── SETTINGS ROW COMPONENT ─────────────────────────────────────────────────
function SettingsRow({
  icon: Icon,
  label,
  sub,
  value,
  onClick,
  iconBg = 'rose',
  badge,
  danger,
}: {
  icon: React.ElementType
  label: string
  sub?: string
  value?: string
  onClick?: () => void
  iconBg?: 'rose' | 'slate' | 'emerald' | 'amber' | 'sky' | 'violet'
  badge?: string
  danger?: boolean
}) {
  const iconBgMap: Record<string, string> = {
    rose: 'bg-rose-50 border-rose-100 text-primary',
    slate: 'bg-slate-100 border-slate-200 text-slate-600',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    sky: 'bg-sky-50 border-sky-100 text-sky-600',
    violet: 'bg-violet-50 border-violet-100 text-violet-600',
  }

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center justify-between p-5 border-b border-slate-50 last:border-0 transition-colors text-left ${
        onClick
          ? danger ? 'hover:bg-rose-50' : 'hover:bg-slate-50'
          : 'cursor-default'
      }`}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${iconBgMap[iconBg]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-xs font-bold ${danger ? 'text-rose-600' : 'text-slate-900'}`}>{label}</h3>
            {badge && (
              <span className="text-[9px] font-black text-white bg-primary px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {value && <span className="text-[11px] font-bold text-slate-500">{value}</span>}
        {onClick && <ChevronRight className={`h-4 w-4 ${danger ? 'text-rose-300' : 'text-slate-300'}`} />}
      </div>
    </button>
  )
}

// ─── MAIN ACCOUNT SETTINGS PAGE ─────────────────────────────────────────────
export function AccountSettingsPage() {
  const { navigate } = useNavigationStore()
  const { user, token, logout } = useAuthStore()

  // Section state
  const [activeSection, setActiveSection] = useState<
    'security' | 'notifications' | 'privacy' | 'appearance' | 'billing' | 'danger'
  >('security')

  // Security toggles
  const [twoFaEnabled, setTwoFaEnabled] = useState(false)
  const [loginAlerts, setLoginAlerts] = useState(true)

  // Notification preferences
  const [notifOrderPush, setNotifOrderPush] = useState(true)
  const [notifOrderEmail, setNotifOrderEmail] = useState(true)
  const [notifOrderSms, setNotifOrderSms] = useState(false)
  const [notifPromoPush, setNotifPromoPush] = useState(false)
  const [notifPricePush, setNotifPricePush] = useState(true)
  const [notifShipPush, setNotifShipPush] = useState(true)

  // Privacy toggles
  const [profilePublic, setProfilePublic] = useState(true)
  const [allowMessages, setAllowMessages] = useState(true)

  // Appearance — initialized from the active next-themes value
  const { theme: activeTheme, setTheme: setAppliedTheme } = useTheme()
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(
    (activeTheme === 'dark' || activeTheme === 'light' || activeTheme === 'system' ? activeTheme : 'light') as 'light' | 'dark' | 'system'
  )

  const handleThemeModeChange = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode)
    setAppliedTheme(mode)
  }

  // Saving states
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [savedNotifications, setSavedNotifications] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [savedPrivacy, setSavedPrivacy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // ─── LOAD CURRENT SETTINGS ────────────────────────────────────────────────
  useEffect(() => {
    async function loadSettings() {
      if (!token) return
      try {
        const [settingsRes, notifRes] = await Promise.all([
          fetch('/api/profile/settings', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/profile/notifications', { headers: { Authorization: `Bearer ${token}` } }),
        ])

        if (settingsRes.ok) {
          const sJson = await settingsRes.json()
          if (sJson.data) {
            setTwoFaEnabled(Boolean(sJson.data.twoFactorEnabled))
            if (sJson.data.privacy) {
              setProfilePublic(Boolean(sJson.data.privacy.profileVisible))
            }
          }
        }

        if (notifRes.ok) {
          const nJson = await notifRes.json()
          if (nJson.prefs) {
            setNotifOrderPush(nJson.prefs.pushOrderUpdates ?? true)
            setNotifPricePush(nJson.prefs.pushPriceDrops ?? true)
            setNotifShipPush(nJson.prefs.pushDelivery ?? true)
            setNotifPromoPush(nJson.prefs.pushPromotions ?? false)
          }
        }
      } catch {
        // Graceful
      }
    }
    loadSettings()
  }, [token])

  // ─── SAVE NOTIFICATION PREFERENCES ─────────────────────────────────────────
  const saveNotifications = async () => {
    setSavingNotifications(true)
    try {
      if (token) {
        await fetch('/api/profile/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            order: { push: notifOrderPush, email: notifOrderEmail, sms: notifOrderSms },
            promotions: { push: notifPromoPush, email: false },
            shipping: { push: notifShipPush, email: true, sms: false },
          }),
        })
      }
      setSavedNotifications(true)
      setTimeout(() => setSavedNotifications(false), 2500)
    } catch {
      // Graceful
    } finally {
      setSavingNotifications(false)
    }
  }

  // ─── SAVE PRIVACY PREFERENCES ──────────────────────────────────────────────
  const savePrivacy = async () => {
    setSavingPrivacy(true)
    try {
      if (token) {
        await fetch('/api/profile/privacy', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            data: {
              profilePublic,
              allowMessages,
            },
          }),
        })
      }
      setSavedPrivacy(true)
      setTimeout(() => setSavedPrivacy(false), 2500)
    } catch {
      // Graceful
    } finally {
      setSavingPrivacy(false)
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button
          onClick={() => navigate('profile')}
          className="p-1 text-slate-700 hover:text-slate-900"
          title="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <span className="text-lg font-black tracking-tight text-primary">Zylod</span>
          <span className="text-[9px] font-bold text-slate-400 block -mt-0.5 uppercase tracking-widest text-center">Settings</span>
        </div>
        <button
          onClick={() => navigate('profile')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          title="Profile"
        >
          <User className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto lg:max-w-3xl">
        {/* Page Title */}
        <div className="px-4 md:px-6 py-5 md:py-6 space-y-1">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Account Settings</h1>
          <p className="text-xs text-slate-500">
            Manage your credentials, alerts, privacy, and account security.
          </p>
        </div>

        {/* Section Navigation Pills (NO EMOJIS, CLEAN ICONS) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-4 md:px-6 pb-3">
          {[
            { key: 'security', label: 'Security', icon: Lock },
            { key: 'notifications', label: 'Notifications', icon: Bell },
            { key: 'privacy', label: 'Privacy', icon: Eye },
            { key: 'appearance', label: 'Appearance', icon: Laptop2 },
            { key: 'billing', label: 'Billing & Tax', icon: CreditCard },
            { key: 'danger', label: 'Danger Zone', icon: AlertTriangle },
          ].map((s) => {
            const Icon = s.icon
            const isActive = activeSection === s.key
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key as typeof activeSection)}
                className={`px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? s.key === 'danger'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-primary text-white shadow-xs font-black'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{s.label}</span>
              </button>
            )
          })}
        </div>

        <div className="px-4 md:px-6 pb-8 md:pb-10 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* ═══════════════════════════════════════════════════════════
                  SECTION 1: SECURITY
              ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'security' && (
                <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:items-start">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">Password &amp; Authentication</span>
                    </div>
                    <SettingsRow
                      icon={Lock}
                      label="Change Password"
                      sub="Update your account password"
                      onClick={() => navigate('reset-password')}
                      iconBg="rose"
                    />
                    <SettingsRow
                      icon={QrCode}
                      label="Two-Factor Authentication (2FA)"
                      sub="Protect your account with TOTP authenticator"
                      badge={twoFaEnabled ? 'ENABLED' : 'OFF'}
                      onClick={() => navigate('two-factor-auth')}
                      iconBg="rose"
                    />
                    <SettingsRow
                      icon={ShieldCheck}
                      label="Edit KYC & Business Info"
                      sub="Update company trade license, TIN, and address"
                      onClick={() => navigate('edit-profile')}
                      iconBg="slate"
                    />
                  </div>

                  {/* Account Verification Details */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Account Credentials</h2>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-slate-500">Email Address</span>
                        <span className="font-bold text-slate-900">{user?.email || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-slate-500">Phone Number</span>
                        <span className="font-bold text-slate-900">{user?.phone || 'Not configured'}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500">Account Role</span>
                        <span className="font-bold text-primary capitalize">{user?.userType || 'User'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  SECTION 2: NOTIFICATIONS
              ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'notifications' && (
                <>
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">Alert Preferences</span>
                    </div>
                    <ToggleRow icon={ShoppingBag} label="Order Status Updates" sub="Instant push alerts for order state changes" checked={notifOrderPush} onChange={setNotifOrderPush} />
                    <ToggleRow icon={Truck} label="Shipping & Tracking Alerts" sub="Real-time freight & delivery notifications" checked={notifShipPush} onChange={setNotifShipPush} />
                    <ToggleRow icon={Zap} label="Price Drop & Restock Alerts" sub="Notifications when watched SKUs change price" checked={notifPricePush} onChange={setNotifPricePush} />
                    <ToggleRow icon={Mail} label="Email Notification Digest" sub="Receive order summaries via email" checked={notifOrderEmail} onChange={setNotifOrderEmail} />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={saveNotifications}
                      disabled={savingNotifications}
                      className={`flex-1 font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 ${
                        savedNotifications ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary/90'
                      } text-white`}
                    >
                      {savingNotifications ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : savedNotifications ? (
                        <><Check className="h-4 w-4" /> Preferences Saved!</>
                      ) : (
                        'Save Notification Settings'
                      )}
                    </Button>
                    <Button
                      onClick={() => navigate('notification-preferences')}
                      variant="outline"
                      className="h-12 px-4 rounded-2xl text-xs font-bold border-slate-200"
                    >
                      Advanced
                    </Button>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  SECTION 3: PRIVACY
              ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'privacy' && (
                <>
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">Visibility Settings</span>
                    </div>
                    <ToggleRow
                      icon={Building2}
                      label="Store / Business Directory Visibility"
                      sub="Allow other verified merchants to see your business profile"
                      checked={profilePublic}
                      onChange={setProfilePublic}
                    />
                    <ToggleRow
                      icon={Mail}
                      label="Direct Messaging Inquiries"
                      sub="Allow buyers or suppliers to initiate chats"
                      checked={allowMessages}
                      onChange={setAllowMessages}
                    />
                  </div>

                  <Button
                    onClick={savePrivacy}
                    disabled={savingPrivacy}
                    className={`w-full font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 ${
                      savedPrivacy ? 'bg-emerald-600 text-white' : 'bg-primary text-white'
                    }`}
                  >
                    {savingPrivacy ? <Loader2 className="h-4 w-4 animate-spin" /> : savedPrivacy ? <><Check className="h-4 w-4" /> Saved</> : 'Save Privacy Options'}
                  </Button>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  SECTION 4: APPEARANCE
              ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'appearance' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Display Theme</h2>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'light', label: 'Light', icon: Sun },
                        { key: 'dark', label: 'Dark', icon: Moon },
                        { key: 'system', label: 'System', icon: Laptop2 },
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => handleThemeModeChange(key as any)}
                          className={`p-3.5 rounded-2xl border-2 text-center space-y-2 transition-all ${
                            themeMode === key ? 'border-primary bg-rose-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <Icon className={`h-5 w-5 mx-auto ${themeMode === key ? 'text-primary' : 'text-slate-500'}`} />
                          <span className={`text-xs font-bold block ${themeMode === key ? 'text-primary' : 'text-slate-600'}`}>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  SECTION 5: BILLING & TAX
              ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'billing' && (
                <>
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">Payment Methods</span>
                    </div>
                    <SettingsRow icon={CreditCard} label="Cards & Bank Transfer" sub="Manage settlement bank accounts" onClick={() => navigate('add-payment-method')} iconBg="rose" />
                    <SettingsRow icon={Receipt} label="Invoices & VAT Receipts" sub="Download commercial invoices" onClick={() => navigate('order-invoice')} iconBg="slate" />
                    <SettingsRow icon={HistoryIcon} label="Payment History" sub="Review completed transactions" onClick={() => navigate('payment-history')} iconBg="slate" />
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  SECTION 6: DANGER ZONE
              ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'danger' && (
                <>
                  <div className="bg-rose-50 rounded-3xl p-5 border border-rose-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-rose-600" />
                      <h2 className="text-sm font-black text-rose-700">Account Management &amp; Sign Out</h2>
                    </div>
                    <p className="text-xs text-rose-600 leading-relaxed">
                      Sign out of your active session or manage account termination.
                    </p>

                    <Button
                      onClick={() => { logout?.(); navigate('login') }}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out of Zylod
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

export default AccountSettingsPage
