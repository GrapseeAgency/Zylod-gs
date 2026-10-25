'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, HelpCircle, Search, MessageSquarePlus, BadgeCheck,
  Loader2, Package, ThumbsUp, AlertCircle, LogIn,
} from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'

/**
 * REAL product Q&A — replaces the fabricated "IndustrialCorp asked about
 * industrial storage bins" dataset (fake questions, fake answers, fake
 * helpful counts that toggled nowhere).
 *
 * Source of truth: GET /api/products/[id]/qa (the Task 93 rail — public
 * read, server-side canAnswer). This page is the product-scoped Q&A browser:
 *   - pageParams.productId required → honest "no product selected" gate
 *     with a product search to pick one
 *   - REAL questions with the asker's real display name
 *   - REAL answers (immutable, one per question) with real helpful counts
 *   - All / Answered / Unanswered filter derived from the real answer field
 *   - Asking & answering happen on the product detail page (the rail's
 *     write surface) — this page deep-links there
 */

interface ApiQa {
  id: string
  question: string
  askedBy: string
  askedAt: string
  answer: string | null
  answeredAt: string | null
  helpful: number
}

type Phase = 'loading' | 'error' | 'ready' | 'anon'

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export function ProductQaPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || pageParams.id || ''

  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [productName, setProductName] = useState<string | null>(null)
  const [qas, setQas] = useState<ApiQa[]>([])
  const [filter, setFilter] = useState<'all' | 'answered' | 'unanswered'>('all')
  const [search, setSearch] = useState('')

  const load = React.useCallback(async () => {
    if (!productId) return
    setPhase('loading')
    try {
      const [prodRes, qaRes] = await Promise.all([
        fetch(`/api/products/${encodeURIComponent(productId)}`, { credentials: 'include' }),
        fetch(`/api/products/${encodeURIComponent(productId)}/qa`, { credentials: 'include' }),
      ])
      const prodJson = prodRes.ok ? await prodRes.json().catch(() => null) : null
      const qaJson = qaRes.ok ? await qaRes.json().catch(() => null) : null
      if (!prodRes.ok || !qaRes.ok) {
        setPhase('error')
        setErrorMsg(qaJson?.error || prodJson?.error || `HTTP ${!prodRes.ok ? prodRes.status : qaRes.status}`)
        return
      }
      const p = prodJson?.data?.product ?? prodJson?.data ?? prodJson?.product ?? null
      setProductName(p?.name ?? null)
      setQas(Array.isArray(qaJson?.data) ? qaJson.data : [])
      setPhase('ready')
    } catch {
      setPhase('error')
      setErrorMsg('Network error — check your connection and retry.')
    }
  }, [productId])

  useEffect(() => { load() }, [load])

  // ── no-product gate ──
  if (!productId) {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center">
              <Search className="h-6 w-6 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">No product selected</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              Q&amp;A is scoped to a single product. Open any product and choose its Q&amp;A tab to
              ask the supplier a question.
            </p>
            <Button onClick={() => navigate('product-list')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <Package className="h-4 w-4" /> Browse products
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const answered = qas.filter(q => q.answer)
  const unanswered = qas.filter(q => !q.answer)
  const visible = (filter === 'all' ? qas : filter === 'answered' ? answered : unanswered)
    .filter(q =>
      !search.trim() ||
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      q.askedBy.toLowerCase().includes(search.toLowerCase()),
    )

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-black text-primary">Product Q&amp;A</h1>
        <span className="w-6" />
      </header>

      <main className="px-4 py-4 md:px-6 md:py-8 space-y-4 max-w-3xl mx-auto">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Product Q&amp;A</h1>
          {productName && (
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              Questions about <span className="font-semibold text-slate-700 dark:text-slate-300">{productName}</span>
            </p>
          )}
        </div>

        {/* Ask CTA — the write surface is the PDP */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{qas.length} question{qas.length === 1 ? '' : 's'} on record</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
              {unanswered.length > 0
                ? `${unanswered.length} awaiting the supplier's answer`
                : answered.length > 0
                  ? 'All answered by the supplier'
                  : 'Be the first to ask'}
            </p>
          </div>
          <Button
            onClick={() => navigate('product-detail', { productId })}
            className="bg-primary text-primary-foreground text-xs font-bold gap-2 shrink-0"
          >
            <MessageSquarePlus className="h-4 w-4" /> Ask a question
          </Button>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions…"
              className="h-11 pl-10 rounded-2xl bg-white dark:bg-gray-900 border-slate-200 dark:border-slate-800 text-xs"
              aria-label="Search questions"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1" role="group" aria-label="Filter questions">
            {([
              { key: 'all', label: `All (${qas.length})` },
              { key: 'answered', label: `Answered (${answered.length})` },
              { key: 'unanswered', label: `Unanswered (${unanswered.length})` },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                aria-pressed={filter === t.key}
                className={
                  'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ' +
                  (filter === t.key
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-200/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80')
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* States */}
        {phase === 'loading' && (
          <PageLoader />
        )}
        {phase === 'error' && (
          <Card className="rounded-3xl border-red-200 shadow-sm">
            <CardContent className="p-8 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Couldn't load Q&amp;A</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 break-words">{errorMsg}</p>
              <Button onClick={load} variant="outline" className="text-xs font-bold gap-2">
                <Loader2 className="h-4 w-4" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}
        {phase === 'ready' && visible.length === 0 && (
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="p-10 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center">
                <HelpCircle className="h-6 w-6 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {qas.length === 0 ? 'No questions yet' : 'Nothing matches'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                {qas.length === 0
                  ? 'Ask the supplier about specs, bulk pricing, lead times, or anything else — the question goes straight to their seller console.'
                  : 'Try a different search term or switch the filter.'}
              </p>
              {qas.length === 0 && (
                <Button onClick={() => navigate('product-detail', { productId })} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
                  <MessageSquarePlus className="h-4 w-4" /> Ask the first question
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Real Q&A list */}
        {phase === 'ready' && visible.map(qa => (
          <Card key={qa.id} className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xs">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words">{qa.question}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
                    Asked by <span className="font-semibold">{qa.askedBy}</span> · {fmt(qa.askedAt)}
                  </p>
                </div>
                {qa.answer ? (
                  <Badge className="bg-emerald-100 text-emerald-700 shrink-0">Answered</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 shrink-0">Awaiting</Badge>
                )}
              </div>

              {qa.answer ? (
                <div className="rounded-2xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-slate-800 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                    <BadgeCheck className="h-3.5 w-3.5" /> Answered by the supplier
                    {qa.answeredAt && <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400 font-medium">· {fmt(qa.answeredAt)}</span>}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words">{qa.answer}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 pt-1">
                    <ThumbsUp className="h-3 w-3" /> {qa.helpful} found this helpful
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-amber-50/50 border border-amber-100 p-4">
                  <p className="text-xs text-amber-800">
                    The supplier has not answered yet. You'll be notified when they do.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {phase === 'anon' && (
          <Card className="rounded-3xl border-amber-200 shadow-sm">
            <CardContent className="p-8 text-center space-y-3">
              <LogIn className="h-6 w-6 text-amber-600 mx-auto" />
              <h2 className="text-base font-bold">Sign in to participate</h2>
              <Button onClick={() => navigate('login')} className="bg-primary text-primary-foreground text-xs font-bold">
                Sign in
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

export default ProductQaPage
