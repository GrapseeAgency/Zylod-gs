'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Link as LinkIcon, Loader2, AlertCircle, Trash2, Plus,
  Globe, MessageCircle, Instagram, Facebook, Lock, RefreshCw
} from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'

/**
 * Real linked contact handles, persisted on the userSettings row via
 * GET/POST /api/profile/linked-accounts + DELETE /api/profile/linked-accounts/[id]
 * (cookies, credentials:'include').
 *
 * These are CONTACT HANDLES (e.g. a WhatsApp number, an Instagram/Facebook
 * page name) — NOT OAuth sign-in connections. The previous page showed five
 * fabricated services (bKash/Nagad settlement, Google SSO…) with a toggle
 * that flipped local state and claimed success without any API call — all of
 * that is gone. What remains is the real list, a real add form, real deletes,
 * the real 5-entry limit, and verbatim server errors. No optimistic writes.
 */

interface LinkedAccount {
  id: string
  provider: string
  handle: string
  linkedAt: string
}

const LINKED_ACCOUNTS_LIMIT = 5

const PROVIDERS: { value: string; label: string; icon: React.ElementType; placeholder: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, placeholder: '+8801XXXXXXXXX' },
  { value: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'facebook.com/yourpage' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, placeholder: '@yourhandle' },
  { value: 'google', label: 'Google', icon: Globe, placeholder: 'your business profile or email' },
]

function providerMeta(provider: string): { label: string; icon: React.ElementType } {
  const found = PROVIDERS.find((p) => p.value === provider)
  return found ? { label: found.label, icon: found.icon } : { label: provider, icon: LinkIcon }
}

export function LinkedAccountsPage() {
  const { goBack, navigate } = useNavigationStore()

  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [configured, setConfigured] = useState(false)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)

  const [provider, setProvider] = useState('whatsapp')
  const [handle, setHandle] = useState('')
  const [formError, setFormError] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    setNeedsAuth(false)
    try {
      const res = await fetch('/api/profile/linked-accounts', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        setAccounts([])
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setLoadError(json?.error || `Failed to load your linked accounts (HTTP ${res.status}).`)
        setAccounts([])
        return
      }
      setAccounts(Array.isArray(json.data?.accounts) ? json.data.accounts : [])
      setConfigured(Boolean(json.data?.configured))
    } catch {
      setLoadError('Network error while loading your linked accounts. Check your connection and retry.')
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (adding) return
    setFormError('')
    setRowError(null)
    const trimmed = handle.trim()
    if (!trimmed) {
      setFormError('Enter the handle or number you want to link.')
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/profile/linked-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, handle: trimmed }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        setFormError(json?.error || 'Your session ended — sign in to manage linked accounts.')
        return
      }
      if (!res.ok || !json?.success) {
        setFormError(json?.error || `Linking this account failed (HTTP ${res.status}).`)
        return
      }
      setAccounts(Array.isArray(json.data?.accounts) ? json.data.accounts : [])
      setConfigured(true)
      setHandle('')
    } catch {
      setFormError('Network error while linking this account. Check your connection and retry.')
    } finally {
      setAdding(false)
    }
  }

  const removeAccount = async (account: LinkedAccount) => {
    if (removingId) return
    setRowError(null)
    setRemovingId(account.id)
    try {
      const res = await fetch(`/api/profile/linked-accounts/${encodeURIComponent(account.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        setRowError({ id: account.id, message: json?.error || 'Your session ended — sign in to manage linked accounts.' })
        return
      }
      if (!res.ok || !json?.success) {
        setRowError({ id: account.id, message: json?.error || `Removing this account failed (HTTP ${res.status}).` })
        return
      }
      setAccounts(Array.isArray(json.data?.accounts) ? json.data.accounts : [])
    } catch {
      setRowError({ id: account.id, message: 'Network error while removing this account. Check your connection and retry.' })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Linked Accounts</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto lg:max-w-3xl px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-slate-900 dark:to-rose-950 rounded-3xl p-5 md:p-6 text-gray-900 dark:text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-black/5 dark:bg-gray-900/10 border border-black/10 dark:border-white/20 flex items-center justify-center">
              <LinkIcon className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-black">Linked Contact Handles</h1>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
                Save the WhatsApp number, Facebook page, or Instagram handle buyers can reach you on. Saved to your account instantly.
              </p>
            </div>
          </div>
        </div>

        {needsAuth ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xs text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
            <h2 className="text-sm font-black">Sign in to manage your linked accounts</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Linked contact handles are stored on your account.</p>
            <Button onClick={() => navigate('login')} className="h-11 px-6 rounded-xl text-xs font-bold">Sign In</Button>
          </div>
        ) : (
          <>
            {/* Real load error + retry */}
            {loadError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-red-600">{loadError}</p>
                </div>
                <Button variant="outline" onClick={loadAccounts} className="h-9 px-3 rounded-xl text-xs font-bold shrink-0">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
                </Button>
              </div>
            )}

            {/* Add form */}
            <form onSubmit={addAccount} className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Link a contact handle</h2>
                {!loading && (
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400">
                    {accounts.length}/{LINKED_ACCOUNTS_LIMIT} linked
                    {configured ? '' : ' · platform default — nothing linked yet'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map((p) => {
                  const Icon = p.icon
                  const isSelected = provider === p.value
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setProvider(p.value)}
                      className={`p-3 rounded-2xl border flex items-center gap-2 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-card'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`} />
                      <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-slate-100'}`}>{p.label}</span>
                    </button>
                  )
                })}
              </div>
              <div>
                <label htmlFor="linked-handle" className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 block mb-1.5">
                  Handle / number
                </label>
                <Input
                  id="linked-handle"
                  value={handle}
                  onChange={(e) => { setHandle(e.target.value); setFormError('') }}
                  placeholder={PROVIDERS.find((p) => p.value === provider)?.placeholder}
                  maxLength={100}
                  className="h-11 rounded-xl text-xs"
                />
              </div>
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-red-600">{formError}</p>
                </div>
              )}
              <Button
                type="submit"
                disabled={adding}
                className="w-full h-11 rounded-2xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-2"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {adding ? 'Linking…' : 'Link this handle'}
              </Button>
            </form>

            {/* Real linked accounts list */}
            <div ref={listRef}>
              {loading ? (
                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs p-8 flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400">
                  <PageLoader className="min-h-0" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xs text-center space-y-2">
                  <LinkIcon className="h-8 w-8 text-slate-400 dark:text-slate-300 mx-auto" />
                  <h3 className="text-sm font-black">No contact handles linked yet</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                    Add a WhatsApp number or a social handle above so buyers know how to reach your business.
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {accounts.map((acc) => {
                    const meta = providerMeta(acc.provider)
                    const Icon = meta.icon
                    const isRemoving = removingId === acc.id
                    return (
                      <div key={acc.id} className="p-4 md:px-6 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-rose-50 border border-rose-100 text-primary flex items-center justify-center shrink-0">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100">{meta.label}</h3>
                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                                LINKED
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5 truncate font-mono">{acc.handle}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                              Linked {acc.linkedAt && acc.linkedAt !== '1970-01-01T00:00:00.000Z' ? new Date(acc.linkedAt).toLocaleDateString() : '—'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => removeAccount(acc)}
                          disabled={removingId !== null}
                          className="h-10 min-h-11 w-11 p-0 rounded-xl text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-red-600 hover:border-red-200 shrink-0"
                          aria-label={`Remove ${meta.label} handle ${acc.handle}`}
                        >
                          {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Per-row removal error — verbatim */}
            {rowError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600">{rowError.message}</p>
              </div>
            )}

            {/* Honest scope note */}
            <div className="bg-slate-100 dark:bg-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500 space-y-1">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
                What these links are — and are not
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
                These are contact handles displayed for buyer outreach. Zylod does not offer OAuth
                sign-in through them, and payment-settlement integrations (bKash / Nagad) do not exist
                yet — they will only appear here when a real integration ships.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default LinkedAccountsPage
