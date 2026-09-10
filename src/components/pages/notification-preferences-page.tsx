'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, Bell, ShoppingBag, Truck, Star, DollarSign, Shield,
  MessageSquare, Clock, Zap, RefreshCw, CheckCircle2, Loader2,
  Check, Smartphone, Mail, Phone, Globe, Volume2, VolumeX,
  Moon, Sun, Calendar, AlertTriangle, Package, BarChart3,
  Award, Settings, Megaphone, FileText, CreditCard, HardHat,
  Layers, Radio, Activity, ChevronDown, ChevronUp, Plus, X
} from 'lucide-react'

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────────
interface NotifCategory {
  id: string
  label: string
  description: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  push: boolean
  email: boolean
  sms: boolean
  whatsapp: boolean
  hasSms?: boolean
  hasWhatsapp?: boolean
}

// ─── NOTIFICATION CATEGORY CARD ───────────────────────────────────────────────
function CategoryCard({
  category,
  onChange,
}: {
  category: NotifCategory
  onChange: (field: 'push' | 'email' | 'sms' | 'whatsapp', value: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = category.icon

  const channelCount = [category.push, category.email, category.sms, category.whatsapp].filter(Boolean).length

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${category.iconBg}`}>
            <Icon className={`h-5 w-5 ${category.iconColor}`} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900">{category.label}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug max-w-[220px] md:max-w-none">{category.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {channelCount > 0 ? (
            <span className="text-[10px] font-black text-primary bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full">
              {channelCount} channel{channelCount > 1 ? 's' : ''} active
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              Muted
            </span>
          )}
          {expanded
            ? <ChevronUp className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded channels */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
              {/* Push toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900">Push Notification</span>
                    <p className="text-[10px] text-slate-400">In-app & mobile banner alerts</p>
                  </div>
                </div>
                <Switch
                  checked={category.push}
                  onCheckedChange={(val) => onChange('push', val)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Email toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900">Email Digest</span>
                    <p className="text-[10px] text-slate-400">Sent to your registered email</p>
                  </div>
                </div>
                <Switch
                  checked={category.email}
                  onCheckedChange={(val) => onChange('email', val)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* SMS toggle */}
              {category.hasSms !== false && (
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900">SMS Alert</span>
                      <p className="text-[10px] text-slate-400">Critical events via text message</p>
                    </div>
                  </div>
                  <Switch
                    checked={category.sms}
                    onCheckedChange={(val) => onChange('sms', val)}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              )}

              {/* WhatsApp toggle */}
              {category.hasWhatsapp !== false && (
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600 shrink-0">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900">WhatsApp Message</span>
                      <p className="text-[10px] text-slate-400">Automated WhatsApp Business updates</p>
                    </div>
                  </div>
                  <Switch
                    checked={category.whatsapp}
                    onCheckedChange={(val) => onChange('whatsapp', val)}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── MAIN NOTIFICATION PREFERENCES PAGE ──────────────────────────────────────
export function NotificationPreferencesPage() {
  const { navigate } = useNavigationStore()
  const { token } = useAuthStore()

  // Notification categories with full channel config
  const [categories, setCategories] = useState<NotifCategory[]>([
    {
      id: 'order_updates',
      label: 'Order Status & Updates',
      description: 'Confirmations, processing, dispatched, and delivery milestones.',
      icon: ShoppingBag,
      iconColor: 'text-primary',
      iconBg: 'bg-rose-50 border-rose-100',
      push: true, email: true, sms: false, whatsapp: true,
    },
    {
      id: 'shipping_logistics',
      label: 'Freight & Shipment Tracking',
      description: 'Live GPS updates, ETA changes, customs clearance, and delivery confirmation.',
      icon: Truck,
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-50 border-sky-100',
      push: true, email: true, sms: true, whatsapp: true,
    },
    {
      id: 'payment_finance',
      label: 'Payments & Financial Events',
      description: 'Invoice due dates, escrow releases, trade credit utilization, and payment receipts.',
      icon: CreditCard,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 border-emerald-100',
      push: true, email: true, sms: false, whatsapp: false,
    },
    {
      id: 'price_alerts',
      label: 'Price Drop & Restock Alerts',
      description: 'Notify when a watched product drops in price or comes back in stock.',
      icon: Zap,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50 border-amber-100',
      push: true, email: false, sms: false, whatsapp: false,
      hasWhatsapp: false,
    },
    {
      id: 'rfq_quotes',
      label: 'RFQ & Quote Activity',
      description: 'New quote responses from suppliers, counter-offers, and quote expiry warnings.',
      icon: FileText,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50 border-violet-100',
      push: true, email: true, sms: false, whatsapp: false,
      hasSms: false,
    },
    {
      id: 'promotions',
      label: 'Promotions & Flash Sales',
      description: 'Seasonal deals, supplier coupons, and platform-wide discount events.',
      icon: Megaphone,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50 border-orange-100',
      push: false, email: true, sms: false, whatsapp: false,
      hasSms: false, hasWhatsapp: false,
    },
    {
      id: 'reviews_feedback',
      label: 'Reviews & Buyer Feedback',
      description: 'New buyer reviews, Q&A responses, and review request reminders.',
      icon: Star,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50 border-amber-100',
      push: true, email: true, sms: false, whatsapp: false,
      hasSms: false, hasWhatsapp: false,
    },
    {
      id: 'kyc_verification',
      label: 'KYC & Account Verification',
      description: 'Identity verification status changes, document approval, and re-verification requests.',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 border-emerald-100',
      push: true, email: true, sms: true, whatsapp: false,
      hasWhatsapp: false,
    },
    {
      id: 'dispute_escrow',
      label: 'Disputes & Trade Assurance',
      description: 'Dispute case updates, escrow hold notifications, and arbitration outcomes.',
      icon: Shield,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50 border-rose-100',
      push: true, email: true, sms: true, whatsapp: true,
    },
    {
      id: 'inventory_alerts',
      label: 'Inventory & Stock Warnings',
      description: 'Low stock threshold alerts, out-of-stock SKUs, and reorder suggestions.',
      icon: Package,
      iconColor: 'text-slate-600',
      iconBg: 'bg-slate-100 border-slate-200',
      push: true, email: false, sms: false, whatsapp: false,
      hasSms: false, hasWhatsapp: false,
    },
    {
      id: 'freight_milestones',
      label: 'Freight Milestone Alerts',
      description: 'Departure from Chittagong port, in-transit location, arrival at destination.',
      icon: Activity,
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-50 border-sky-100',
      push: true, email: true, sms: false, whatsapp: true,
      hasSms: false,
    },
    {
      id: 'security_alerts',
      label: 'Security & Account Safety',
      description: 'Login attempts, password changes, and suspicious activity. Always required.',
      icon: AlertTriangle,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50 border-rose-100',
      push: true, email: true, sms: true, whatsapp: false,
      hasWhatsapp: false,
    },
    {
      id: 'analytics_reports',
      label: 'Analytics & Weekly Reports',
      description: 'Weekly business performance digest, revenue insights, and trend summaries.',
      icon: BarChart3,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50 border-violet-100',
      push: false, email: true, sms: false, whatsapp: false,
      hasSms: false, hasWhatsapp: false,
    },
    {
      id: 'platform_updates',
      label: 'Platform & System Updates',
      description: 'Scheduled maintenance windows, new feature announcements, and policy changes.',
      icon: Layers,
      iconColor: 'text-slate-600',
      iconBg: 'bg-slate-100 border-slate-200',
      push: false, email: true, sms: false, whatsapp: false,
      hasSms: false, hasWhatsapp: false,
    },
  ])

  // Quiet hours
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true)
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')

  // Master mute
  const [masterMute, setMasterMute] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testSent, setTestSent] = useState(false)

  // ─── UPDATE CATEGORY ───────────────────────────────────────────────────────
  const updateCategory = (
    id: string,
    field: 'push' | 'email' | 'sms' | 'whatsapp',
    value: boolean
  ) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat))
    )
  }

  // Mute all / Enable all
  const muteAll = () => {
    setMasterMute(true)
    setCategories((prev) =>
      prev.map((cat) => ({ ...cat, push: false, email: false, sms: false, whatsapp: false }))
    )
  }

  const enableAll = () => {
    setMasterMute(false)
    setCategories((prev) =>
      prev.map((cat) => ({ ...cat, push: true, email: true }))
    )
  }

  // ─── SAVE ──────────────────────────────────────────────────────────────────
  const savePreferences = async () => {
    setSaving(true)
    try {
      if (token) {
        const payload = {
          categories: categories.reduce<Record<string, object>>((acc, cat) => {
            acc[cat.id] = {
              push: cat.push,
              email: cat.email,
              sms: cat.sms,
              whatsapp: cat.whatsapp,
            }
            return acc
          }, {}),
          quietHours: {
            enabled: quietHoursEnabled,
            start: quietStart,
            end: quietEnd,
          },
        }
        await fetch('/api/profile/notifications', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // Graceful
    } finally {
      setSaving(false)
    }
  }

  // ─── TEST NOTIFICATION ─────────────────────────────────────────────────────
  const sendTestNotification = async () => {
    setTesting(true)
    try {
      if (token) {
        await fetch('/api/notifications/test', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      setTestSent(true)
      setTimeout(() => setTestSent(false), 3000)
    } catch {
      // Graceful
    } finally {
      setTesting(false)
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 md:pb-8">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button
          onClick={() => navigate('profile')}
          className="p-1 text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <span className="text-base font-black tracking-tight text-primary">Notification Settings</span>
        </div>
        <button
          onClick={() => navigate('account-settings')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto lg:max-w-5xl px-4 py-5 md:px-6 md:py-6 space-y-5 md:space-y-8">
        {/* Hero Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Bell className="h-6 w-6 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base md:text-2xl font-black">Notification Preferences</h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Control exactly how and when Zylod reaches you — across 14 event categories and 4 delivery channels.
              </p>
            </div>
          </div>

          {/* Master controls */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10 mt-2">
            <Button
              onClick={masterMute ? enableAll : muteAll}
              className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                masterMute
                  ? 'bg-white text-slate-900 hover:bg-slate-100'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
              }`}
            >
              {masterMute ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {masterMute ? 'Unmute All Channels' : 'Mute All Channels'}
            </Button>
            <Button
              onClick={sendTestNotification}
              disabled={testing || testSent}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-white/10 border border-white/20 text-white hover:bg-white/20 flex items-center justify-center gap-1.5"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : testSent ? (
                <><Check className="h-4 w-4 text-emerald-300" /> Sent!</>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Test Alert
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Channel Summary Row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Smartphone, label: 'Push', count: categories.filter((c) => c.push).length, color: 'text-primary bg-rose-50 border-rose-100' },
            { icon: Mail, label: 'Email', count: categories.filter((c) => c.email).length, color: 'text-sky-600 bg-sky-50 border-sky-100' },
            { icon: Phone, label: 'SMS', count: categories.filter((c) => c.sms).length, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
            { icon: Globe, label: 'WhatsApp', count: categories.filter((c) => c.whatsapp).length, color: 'text-green-600 bg-green-50 border-green-100' },
          ].map(({ icon: Icon, label, count, color }) => (
            <div key={label} className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs text-center">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center mx-auto ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-lg font-black text-slate-900 font-mono mt-1.5">{count}</div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
          ))}
        </div>

        {/* Quiet Hours */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <Moon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900">Quiet Hours — Do Not Disturb</h2>
                <p className="text-[11px] text-slate-400">Suppress push &amp; SMS during sleep hours</p>
              </div>
            </div>
            <Switch
              checked={quietHoursEnabled}
              onCheckedChange={setQuietHoursEnabled}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          <AnimatePresence>
            {quietHoursEnabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[11px] text-slate-500">
                    During quiet hours, push and SMS notifications are silently queued and delivered at your wake time.
                    Email and WhatsApp are not affected.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                        <Moon className="h-3 w-3" />
                        Sleep (Quiet Start)
                      </label>
                      <input
                        type="time"
                        value={quietStart}
                        onChange={(e) => setQuietStart(e.target.value)}
                        className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm font-bold text-slate-900 font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                        <Sun className="h-3 w-3" />
                        Wake (Quiet End)
                      </label>
                      <input
                        type="time"
                        value={quietEnd}
                        onChange={(e) => setQuietEnd(e.target.value)}
                        className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm font-bold text-slate-900 font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center gap-2">
                    <Moon className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-[11px] font-bold text-slate-700">
                      Quiet from <span className="text-primary font-black">{quietStart}</span> to <span className="text-primary font-black">{quietEnd}</span> (BST — Asia/Dhaka)
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Category Cards */}
        <div className="space-y-1">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1 pb-1">
            Event Categories — {categories.length} total
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              onChange={(field, value) => updateCategory(cat.id, field, value)}
            />
          ))}
        </div>

        {/* Save Preferences */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={savePreferences}
            disabled={saving}
            className={`w-full font-bold h-14 rounded-2xl text-xs shadow-lg flex items-center justify-center gap-2 transition-all ${
              saved
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-primary hover:bg-primary/90'
            } text-white`}
          >
            {saving ? (
              <><Loader2 className="h-5 w-5 animate-spin" />Saving Preferences...</>
            ) : saved ? (
              <><CheckCircle2 className="h-5 w-5" />Preferences Saved Successfully!</>
            ) : (
              <><Bell className="h-5 w-5" />Save All Notification Preferences</>
            )}
          </Button>

          <Button
            onClick={sendTestNotification}
            disabled={testing || testSent}
            variant="outline"
            className="w-full font-bold h-11 rounded-2xl text-xs border-slate-200 bg-white flex items-center justify-center gap-2 text-slate-700 hover:bg-slate-50"
          >
            {testing ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Sending Test...</>
            ) : testSent ? (
              <><Check className="h-4 w-4 text-emerald-600" />Test Notification Sent!</>
            ) : (
              <><Smartphone className="h-4 w-4" />Send Test Notification to My Device</>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}

export default NotificationPreferencesPage
