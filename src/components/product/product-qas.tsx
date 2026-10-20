'use client'

/**
 * THE PRODUCT Q&A SURFACE (Task 93) — the pre-purchase conversation,
 * fed ONLY by the real productQas rail:
 *
 *   - Public list: real questions with the asker's REAL display name,
 *     answers attributed by time. Honest empty state — never seeded
 *     with fake Q&A.
 *   - Ask: any signed-in user asks through the real POST rail; anonymous
 *     visitors get an honest sign-in prompt, never a fake form.
 *   - Answer: rendered ONLY when the GET says canAnswer (the server
 *     resolved the caller as the product's owning supplier or admin) —
 *     inline on unanswered rows, immutable once answered (409 enforced
 *     server-side).
 *   - Live: listens on the PUBLIC product:<id> room — a question asked
 *     from another tab or an answer landing refreshes the list without
 *     a reload.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import { useAuthStore } from '@/store/auth-store'
import { toast } from 'sonner'
import {
  HelpCircle, Loader2, MessageSquareText, Send, ShieldQuestion, User,
} from 'lucide-react'

interface QaRow {
  id: string
  question: string
  askedBy: string
  askedAt: string
  answer: string | null
  answeredAt: string | null
  helpful: number
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ProductQas({ productId }: { productId: string }) {
  const user = useAuthStore((s) => s.user)
  const [qas, setQas] = useState<QaRow[] | null>(null)
  const [canAnswer, setCanAnswer] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({})
  const [answeringId, setAnsweringId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!productId) return
    try {
      const res = await fetch(`/api/products/${productId}/qa`, { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (res.ok && json) {
        setQas(Array.isArray(json.data) ? json.data : [])
        setCanAnswer(Boolean(json.canAnswer))
        setLoadError('')
      } else {
        setLoadError(json?.error || 'Failed to load Q&A')
      }
    } catch {
      setLoadError('Failed to load Q&A')
    }
  }, [productId])

  useEffect(() => { load() }, [load])

  // PUBLIC product room — asks/answers refresh the open PDP live.
  useRealtimeRoom(productId ? [`product:${productId}`] : [], {
    onEvent: (m) => { if (m.event === 'product:qa') load() },
  })

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    setAskError('')
    setAsking(true)
    try {
      const res = await fetch(`/api/products/${productId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: question.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201) {
        toast.success('Question sent — the supplier has been notified')
        setQuestion('')
        load()
      } else if (res.status === 400 && json?.issues) {
        const first = Object.values(json.issues as Record<string, string[]>)[0]?.[0]
        setAskError(first || json.error || 'Invalid question')
      } else {
        setAskError(json?.error || `Failed to send question (${res.status})`)
      }
    } catch {
      setAskError('Network error — question not sent')
    } finally {
      setAsking(false)
    }
  }

  const submitAnswer = async (qaId: string) => {
    const answer = (answerDraft[qaId] || '').trim()
    setAnsweringId(qaId)
    try {
      const res = await fetch(`/api/products/${productId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ qaId, answer }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast.success('Answer published — the buyer has been notified')
        setAnswerDraft((d) => ({ ...d, [qaId]: '' }))
        load()
      } else {
        toast.error(json?.error || `Failed to publish answer (${res.status})`)
      }
    } catch {
      toast.error('Network error — answer not published')
    } finally {
      setAnsweringId(null)
    }
  }

  if (qas === null && !loadError) {
    return (
      <div className="flex items-center gap-2 p-6 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading Q&amp;A…
      </div>
    )
  }

  if (loadError) {
    return <div className="p-6 text-xs text-rose-600">{loadError}</div>
  }

  const list = qas ?? []
  const answeredCount = list.filter((q) => q.answer).length

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-black text-slate-900">Questions &amp; answers</h3>
        {list.length > 0 && (
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {list.length} question{list.length === 1 ? '' : 's'} · {answeredCount} answered
          </span>
        )}
      </div>

      {/* Ask form — honest sign-in gate for anonymous visitors */}
      {user ? (
        <form onSubmit={submitQuestion} className="space-y-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask the supplier about this product (minimum order, materials, bulk pricing…)`}
            rows={3}
            maxLength={500}
            className="text-xs bg-white resize-none"
            aria-label="Your question"
          />
          {askError && (
            <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {askError}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400">{question.trim().length < 5 ? 'Minimum 5 characters' : `${question.length}/500`}</span>
            <Button
              type="submit"
              disabled={asking || question.trim().length < 5}
              className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold"
            >
              {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Ask the supplier
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
          <HelpCircle className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-500">
            <Link href="/?page=login" className="font-bold text-primary hover:underline">Sign in</Link>
            {' '}to ask the supplier a question about this product.
          </p>
        </div>
      )}

      {/* The real thread */}
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="flex items-start gap-3 p-4">
            <ShieldQuestion className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500">
              No questions yet. Be the first to ask — answers here are published for every buyer to see.
            </p>
          </div>
        ) : (
          list.map((qa) => (
            <div key={qa.id} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              <div className="p-3.5 pb-2">
                <p className="text-xs font-bold text-slate-900">{qa.question}</p>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <User className="h-3 w-3" /> {qa.askedBy} · {fmt(qa.askedAt)}
                </p>
              </div>
              {qa.answer ? (
                <div className="mx-3.5 mb-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 p-3">
                  <p className="text-xs text-slate-800 leading-relaxed">{qa.answer}</p>
                  <p className="text-[10px] text-emerald-700 font-bold mt-1.5 uppercase tracking-wide">
                    Supplier&apos;s answer · {qa.answeredAt ? fmt(qa.answeredAt) : ''}
                  </p>
                </div>
              ) : canAnswer ? (
                <div className="mx-3.5 mb-3.5 rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
                  <Textarea
                    value={answerDraft[qa.id] || ''}
                    onChange={(e) => setAnswerDraft((d) => ({ ...d, [qa.id]: e.target.value }))}
                    placeholder="Answer this buyer's question (published on the product page)…"
                    rows={2}
                    maxLength={2000}
                    className="text-xs bg-white resize-none"
                    aria-label={`Answer to: ${qa.question}`}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={() => submitAnswer(qa.id)}
                      disabled={answeringId === qa.id || (answerDraft[qa.id] || '').trim().length < 2}
                      className="h-8 px-3 rounded-xl bg-primary text-white text-[11px] font-bold"
                    >
                      {answeringId === qa.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                      Publish answer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mx-3.5 mb-3.5 rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[11px] text-slate-400 italic">Awaiting the supplier&apos;s answer.</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
