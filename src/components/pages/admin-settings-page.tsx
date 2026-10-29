'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminAppStatusManager } from '@/components/admin/admin-app-status-manager'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { toast } from 'sonner'
import {
  Settings, RefreshCw, AlertTriangle, Save, Lock, Globe, Inbox,
} from 'lucide-react'

// ── Real API types (GET /api/admin/settings · PUT /api/admin/settings/[key]) ──
interface ApiAdminSetting {
  key: string
  label: string
  category: string
  /** Server-registry description — states truthfully what consumes the setting. */
  description: string
  valueType: 'int' | 'string' | 'boolean'
  isPublic: boolean
  /** Stored typed value — null when unset (the built-in default is in effect). */
  value: string | number | boolean | null
  defaultValue: string | number | boolean
  updatedAt: string | null
}

const REFRESH_INTERVAL_MS = 30_000

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 rounded-lg px-2 py-1 text-slate-500 dark:text-neutral-400'

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/** Baseline draft text for a text/number field — empty string when unset. */
function baselineText(setting: ApiAdminSetting): string {
  if (setting.valueType === 'boolean') return ''
  return setting.value == null ? '' : String(setting.value)
}

/** Baseline for a boolean switch — the default is in effect when unset. */
function baselineBool(setting: ApiAdminSetting): boolean {
  if (typeof setting.value === 'boolean') return setting.value
  return setting.defaultValue === true
}

export function AdminSettingsPage() {
  const { navigate } = useNavigationStore()

  const [settings, setSettings] = useState<ApiAdminSetting[]>([])
  const [dataNotes, setDataNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Per-field drafts (no optimistic writes — server responses applied on 2xx only)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [boolDrafts, setBoolDrafts] = useState<Record<string, boolean>>({})
  const [savingCategory, setSavingCategory] = useState<string | null>(null)
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const activityRef = useRef(false)

  // Real dirty-state tracking per key (drives Save buttons + pauses auto-refresh)
  const dirtyKeys = useMemo(() => {
    const dirty = new Set<string>()
    for (const s of settings) {
      if (s.valueType === 'boolean') {
        const draft = boolDrafts[s.key]
        if (draft !== undefined && draft !== baselineBool(s)) dirty.add(s.key)
      } else {
        const draft = drafts[s.key]
        if (draft !== undefined && draft !== baselineText(s)) dirty.add(s.key)
      }
    }
    return dirty
  }, [settings, drafts, boolDrafts])

  useEffect(() => {
    activityRef.current = dirtyKeys.size > 0 || savingCategory !== null
  }, [dirtyKeys, savingCategory])

  // Draft mirrors so loadSettings can rebase drafts without stale closures.
  const draftsRef = useRef(drafts)
  const boolDraftsRef = useRef(boolDrafts)
  const dirtyKeysRef = useRef(dirtyKeys)
  useEffect(() => { draftsRef.current = drafts }, [drafts])
  useEffect(() => { boolDraftsRef.current = boolDrafts }, [boolDrafts])
  useEffect(() => { dirtyKeysRef.current = dirtyKeys }, [dirtyKeys])

  const loadSettings = useCallback(async (background = false) => {
    // A background refresh never fights a foreground load.
    if (background && inflightRef.current) return
    inflightRef.current = true
    const seq = ++seqRef.current
    const apply = (fn: () => void) => { if (seq === seqRef.current) fn() }
    if (background) apply(() => setRefreshing(true))
    else {
      setLoading(true)
      setError('')
      setRefreshError('')
    }
    apply(() => setRefreshError(''))
    try {
      const res = await fetch('/api/admin/settings', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setSettings([]) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load settings (HTTP ${res.status})`
        apply(() => { if (background) setRefreshError(msg); else setError(msg) })
        return
      }
      const list: ApiAdminSetting[] = Array.isArray(json.data?.settings) ? json.data.settings : []
      apply(() => {
        setSettings(list)
        setDataNotes(Array.isArray(json.data?.dataNotes) ? json.data.dataNotes : [])
        setLastUpdated(new Date())
        setNeedsAuth(false)
        // Rebase drafts: untouched fields follow the server; fields the admin
        // is actively editing (dirty) keep their draft on background refreshes —
        // a refresh never wipes typing. A foreground load resets all drafts.
        const dirty = dirtyKeysRef.current
        setDrafts(() => {
          const next: Record<string, string> = {}
          for (const s of list) {
            if (s.valueType === 'boolean') continue
            next[s.key] = background && dirty.has(s.key)
              ? (draftsRef.current[s.key] ?? baselineText(s))
              : baselineText(s)
          }
          return next
        })
        setBoolDrafts(() => {
          const next: Record<string, boolean> = {}
          for (const s of list) {
            if (s.valueType !== 'boolean') continue
            next[s.key] = background && dirty.has(s.key)
              ? (boolDraftsRef.current[s.key] ?? baselineBool(s))
              : baselineBool(s)
          }
          return next
        })
      })
    } catch {
      const msg = 'Network error while loading settings. Check your connection and retry.'
      apply(() => { if (background) setRefreshError(msg); else setError(msg) })
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [])

  // Initial load + auto-refresh every 30s — PAUSED while any field is dirty/editing
  useEffect(() => {
    loadSettings()
    const id = setInterval(() => { if (!activityRef.current) loadSettings(true) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadSettings])

  const grouped = useMemo(() => {
    const order: string[] = []
    const byCategory = new Map<string, ApiAdminSetting[]>()
    for (const s of settings) {
      const list = byCategory.get(s.category)
      if (list) list.push(s)
      else {
        byCategory.set(s.category, [s])
        order.push(s.category)
      }
    }
    return order.map((category) => ({ category, settings: byCategory.get(category) ?? [] }))
  }, [settings])

  const configuredCount = useMemo(() => settings.filter((s) => s.value != null).length, [settings])

  const applySaved = (saved: ApiAdminSetting) => {
    setSettings((prev) => prev.map((s) => (s.key === saved.key ? saved : s)))
    if (saved.valueType === 'boolean') {
      setBoolDrafts((prev) => ({ ...prev, [saved.key]: baselineBool(saved) }))
    } else {
      setDrafts((prev) => ({ ...prev, [saved.key]: baselineText(saved) }))
    }
  }

  const saveCard = async (category: string, keys: string[]) => {
    if (savingCategory) return
    setSavingCategory(category)
    setCardErrors((prev) => ({ ...prev, [category]: '' }))
    try {
      for (const key of keys) {
        const entry = settings.find((s) => s.key === key)
        if (!entry) continue
        let bodyValue: unknown
        if (entry.valueType === 'boolean') {
          bodyValue = boolDrafts[key]
        } else if (entry.valueType === 'int') {
          const raw = (drafts[key] ?? '').trim()
          if (!/^-?\d+$/.test(raw)) {
            const msg = `"${entry.label}" must be a whole number.`
            setCardErrors((prev) => ({ ...prev, [category]: msg }))
            toast.error(msg)
            return
          }
          bodyValue = Number(raw)
        } else {
          bodyValue = drafts[key] ?? ''
        }
        const res = await fetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ value: bodyValue }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          // Verbatim backend error (400 validation, 404 unknown key, 429, 401 …)
          const msg = json?.error || `Could not save "${entry.label}" (HTTP ${res.status})`
          setCardErrors((prev) => ({ ...prev, [category]: msg }))
          toast.error(msg)
          return // stop on the first failure — later fields are NOT claimed as saved
        }
        applySaved(json.data as ApiAdminSetting)
        toast.success(json.message || `Setting "${entry.label}" saved.`)
      }
      loadSettings(true)
    } catch {
      const msg = 'Network error while saving settings. Check your connection and retry.'
      setCardErrors((prev) => ({ ...prev, [category]: msg }))
      toast.error(msg)
    } finally {
      setSavingCategory(null)
    }
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">Platform settings are restricted to Zylod admins. Sign in with an admin account to view and change real settings.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  const statChips: { label: string; value: number | null }[] = [
    { label: 'Registered settings', value: settings.length > 0 ? settings.length : null },
    { label: 'Configured', value: settings.length > 0 ? configuredCount : null },
    { label: 'Using built-in defaults', value: settings.length > 0 ? settings.length - configuredCount : null },
    { label: 'Unsaved edits', value: settings.length > 0 ? dirtyKeys.size : null },
  ]

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header (slate, Settings-themed) */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-card border border-slate-200 dark:border-neutral-800 flex items-center justify-center">
            <Settings className="h-5 w-5 text-slate-600 dark:text-neutral-400 dark:text-neutral-500 dark:text-neutral-300" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Admin Settings</h1>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Real platform settings stored in the adminSettings table. Every change is a real, audit-logged database write and takes effect for its documented consumer immediately. Nothing here is decorative.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 tabular-nums">Updated {lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s (paused while editing)</span>
          )}
          <Button
            variant="outline"
            onClick={() => loadSettings(true)}
            disabled={refreshing}
            className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-neutral-800 dark:border-neutral-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Real stats chips (from the same GET that feeds the cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statChips.map((chip) => (
          <div key={chip.label} className="rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-neutral-800 p-3">
            <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-neutral-500 dark:text-neutral-400">{chip.label}</p>
            <p className="text-lg font-black text-slate-800 dark:text-neutral-200 tabular-nums">
              {chip.value == null ? '—' : chip.value.toLocaleString('en-BD')}
            </p>
          </div>
        ))}
      </div>

      {/* Verbatim refresh error (last good data — even an honest empty list — stays on screen) */}
      {refreshError && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-2xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 font-bold">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-words">{refreshError}</span>
          <button onClick={() => loadSettings(true)} className="ml-auto underline underline-offset-2 shrink-0">Retry</button>
        </div>
      )}

      {/* States */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-neutral-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load settings</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadSettings()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : settings.length === 0 ? (
        // Honest empty state — the registry should never produce this, but it is stated, not faked
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-slate-200 dark:border-neutral-800 text-center space-y-2">
          <Inbox className="h-10 w-10 text-slate-300 dark:text-neutral-700 dark:text-neutral-300 mx-auto" />
          <h2 className="text-sm font-black">No settings registered</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-md mx-auto leading-relaxed">
            The settings registry (src/lib/admin-settings.ts) currently defines no keys — nothing is invented here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin pr-1 space-y-3">
            {grouped.map((group) => {
              const dirtyInCard = group.settings.filter((s) => dirtyKeys.has(s.key))
              const cardError = cardErrors[group.category] ?? ''
              const busy = savingCategory === group.category
              return (
                <div key={group.category} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800">
                  {/* Card head */}
                  <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-neutral-800">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">{group.category}</p>
                    <span className={chipClass}>{group.settings.length} setting{group.settings.length === 1 ? '' : 's'}</span>
                    {dirtyInCard.length > 0 && (
                      <Badge variant="outline" className="text-[10px] font-black rounded-lg bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900">
                        {dirtyInCard.length} UNSAVED EDIT{dirtyInCard.length === 1 ? '' : 'S'}
                      </Badge>
                    )}
                  </div>

                  {/* Fields */}
                  <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {group.settings.map((s) => {
                      const isDirty = dirtyKeys.has(s.key)
                      return (
                        <div key={s.key} className="px-4 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Label htmlFor={`setting-${s.key}`} className="text-xs font-black text-slate-800 dark:text-neutral-200">{s.label}</Label>
                              {s.isPublic ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"><Globe className="h-3 w-3" /> Public</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-neutral-500 dark:text-neutral-400"><Lock className="h-3 w-3" /> Private</span>
                              )}
                            </div>
                            <p className="font-mono text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 break-all">{s.key}</p>
                            <p className="text-[10px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 leading-relaxed break-words">{s.description}</p>
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              {s.value != null ? (
                                <>
                                  <Badge variant="outline" className="text-[10px] font-black rounded-lg bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900">
                                    SET · {String(s.value)}
                                  </Badge>
                                  {s.updatedAt && <span className={chipClass}>updated {formatTimestamp(s.updatedAt)}</span>}
                                </>
                              ) : (
                                <Badge variant="outline" className="text-[10px] font-black rounded-lg bg-slate-50 text-slate-500 border-slate-200 dark:bg-background dark:text-neutral-400 dark:text-neutral-500 dark:border-neutral-800">
                                  Not set — built-in default ({String(s.defaultValue)}) in effect
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="w-full sm:w-64 shrink-0">
                            {s.valueType === 'boolean' ? (
                              <div className="flex items-center gap-2 min-h-11">
                                <Switch
                                  id={`setting-${s.key}`}
                                  checked={boolDrafts[s.key] ?? baselineBool(s)}
                                  onCheckedChange={(checked) => setBoolDrafts((prev) => ({ ...prev, [s.key]: checked }))}
                                />
                                <span className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">{(boolDrafts[s.key] ?? baselineBool(s)) ? 'On' : 'Off'}</span>
                              </div>
                            ) : (
                              <Input
                                id={`setting-${s.key}`}
                                type={s.valueType === 'int' ? 'number' : 'text'}
                                inputMode={s.valueType === 'int' ? 'numeric' : undefined}
                                value={drafts[s.key] ?? ''}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                                placeholder={s.value == null ? `Not set — default: ${String(s.defaultValue)}` : ''}
                                className={`h-10 rounded-xl text-xs ${s.valueType === 'int' ? 'tabular-nums' : ''}`}
                              />
                            )}
                            {isDirty && <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">Unsaved change</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Card footer: verbatim error + per-card save */}
                  {(cardError || dirtyInCard.length > 0) && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-neutral-800 space-y-2">
                      {cardError && (
                        <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {cardError}
                        </div>
                      )}
                      {dirtyInCard.length > 0 && (
                        <Button
                          onClick={() => saveCard(group.category, dirtyInCard.map((s) => s.key))}
                          disabled={busy || savingCategory !== null}
                          className="min-h-11 px-4 rounded-xl text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-white"
                        >
                          <Save className="h-3.5 w-3.5" /> {busy ? 'Saving…' : `Save ${dirtyInCard.length} change${dirtyInCard.length === 1 ? '' : 's'}`}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Honest data notes straight from the API */}
          {dataNotes.length > 0 && (
            <div className="rounded-2xl border border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-background/40 p-4 space-y-1">
              {dataNotes.map((noteLine, i) => (
                <p key={i} className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 leading-relaxed">· {noteLine}</p>
              ))}
            </div>
          )}

          {/* Task 109: platform status rail — releases, maintenance, service log */}
          <div className="rounded-2xl border border-slate-100 dark:border-neutral-800 bg-white dark:bg-gray-900 p-4">
            <AdminAppStatusManager />
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminSettingsPage
