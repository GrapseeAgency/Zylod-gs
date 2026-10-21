'use client'

/**
 * MiniGamesPage — Task 112: REAL games. The old page faked gameplay ("Play"
 * hardcoded a score of 85 and claimed points for it). Every game now runs on
 * server proof: the quiz deals real questions graded server-side, the cargo
 * matcher flashes a server-dealt sequence and grades the reproduction, and
 * the mystery crate is rolled server-side. No alert() — house toasts only.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { soundEffects } from '@/lib/sound-effects'
import {
  ArrowLeft, Gamepad2, Sparkles, Brain, Layers, Package, Play, History,
  CheckCircle2, XCircle, Timer, Gift,
} from 'lucide-react'

interface GameCard {
  id: string
  title: string
  desc: string
  reward: string
  icon: string
  color: string
  dailyLimit: number
}

interface Question {
  id: number
  q: string
  options: string[]
}

const MEMORY_SYMBOL_GLYPHS: Record<string, string> = {
  truck: '🚚', container: '🛳️', crate: '📦', pallet: '🪵',
  forklift: '🏗️', vessel: '⚓', scale: '⚖️', warehouse: '🏭',
}

export function MiniGamesPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [games, setGames] = useState<GameCard[]>([])
  const [usage, setUsage] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)

  const [quiz, setQuiz] = useState<{ challengeId: string; questions: Question[]; answers: Record<number, number> } | null>(null)
  const [quizResult, setQuizResult] = useState<{ correct: number; total: number; pointsWon: number; message: string } | null>(null)
  const [quizBusy, setQuizBusy] = useState(false)

  const [mem, setMem] = useState<{
    challengeId: string
    sequence: string[]
    phase: 'flash' | 'input' | 'done'
    shownIndex: number
    picked: string[]
  } | null>(null)
  const [memResult, setMemResult] = useState<{ correct: number; total: number; pointsWon: number; dealt: string[] } | null>(null)
  const memTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const [crateBusy, setCrateBusy] = useState(false)
  const [crateResult, setCrateResult] = useState<{ won: boolean; message: string; prize?: { code: string; value: number } | null } | null>(null)

  const loadGames = useCallback(async () => {
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/mini-games', { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setGames(data.data.games || [])
        setUsage(data.data.usage ?? null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadGames()
    return () => { memTimers.current.forEach(clearTimeout) }
  }, [loadGames])

  const requireAuth = (): boolean => {
    if (token) return true
    toast.error('Sign in to play — points are personal')
    navigate('login')
    return false
  }

  /* ── TRIVIA: real paper, graded server-side ── */
  const startQuiz = async () => {
    if (!requireAuth()) return
    setQuizBusy(true)
    try {
      const res = await fetch('/api/mini-games/trivia/start', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok && data.success) {
        setQuizResult(null)
        setQuiz({ challengeId: data.data.challengeId, questions: data.data.questions, answers: {} })
      } else {
        toast.error(data.error || 'Could not deal a quiz paper')
      }
    } catch {
      toast.error('Could not reach the games service')
    } finally {
      setQuizBusy(false)
    }
  }

  const submitQuiz = async () => {
    if (!quiz) return
    const unanswered = quiz.questions.filter((q) => quiz.answers[q.id] === undefined).length
    if (unanswered > 0) {
      toast.error(`Answer all questions first — ${unanswered} left`)
      return
    }
    setQuizBusy(true)
    try {
      const res = await fetch('/api/mini-games/trivia/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          challengeId: quiz.challengeId,
          answers: quiz.questions.map((q) => ({ id: q.id, choice: quiz.answers[q.id] })),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        soundEffects.playByName('chime')
        setQuizResult(data.data)
        toast.success(data.data.message)
        loadGames()
      } else {
        toast.error(data.error || 'Could not grade the paper')
      }
    } catch {
      toast.error('Could not reach the games service')
    } finally {
      setQuizBusy(false)
    }
  }

  /* ── MEMORY: server-dealt sequence, flashed, reproduced ── */
  const startMemory = async () => {
    if (!requireAuth()) return
    try {
      const res = await fetch('/api/mini-games/memory/start', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok && data.success) {
        setMemResult(null)
        const seq: string[] = data.data.sequence
        setMem({ challengeId: data.data.challengeId, sequence: seq, phase: 'flash', shownIndex: 0, picked: [] })
        memTimers.current.forEach(clearTimeout)
        memTimers.current = []
        seq.forEach((_, i) => {
          memTimers.current.push(setTimeout(() => {
            setMem((m) => (m ? { ...m, shownIndex: i + 1 } : m))
          }, 700 * (i + 1)))
        })
        memTimers.current.push(setTimeout(() => {
          setMem((m) => (m ? { ...m, phase: 'input', shownIndex: seq.length } : m))
        }, 700 * seq.length + 600))
      } else {
        toast.error(data.error || 'Could not deal a sequence')
      }
    } catch {
      toast.error('Could not reach the games service')
    }
  }

  const pickSymbol = (sym: string) => {
    setMem((m) => {
      if (!m || m.phase !== 'input') return m
      const picked = [...m.picked, sym]
      if (picked.length === m.sequence.length) {
        submitMemory(m.challengeId, picked)
      }
      return { ...m, picked }
    })
  }

  const submitMemory = async (challengeId: string, picked: string[]) => {
    try {
      const res = await fetch('/api/mini-games/memory/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ challengeId, sequence: picked }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        soundEffects.playByName('chime')
        setMem((m) => (m ? { ...m, phase: 'done' } : m))
        setMemResult({ correct: data.data.correct, total: data.data.total, pointsWon: data.data.pointsWon, dealt: data.data.dealtSequence })
        toast.success(data.data.message)
        loadGames()
      } else {
        setMem(null)
        toast.error(data.error || 'Could not grade the round')
      }
    } catch {
      setMem(null)
      toast.error('Could not reach the games service')
    }
  }

  /* ── CRATE: the server rolled long before you clicked ── */
  const openCrate = async () => {
    if (!requireAuth()) return
    setCrateBusy(true)
    try {
      const res = await fetch('/api/mini-games/box/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setCrateResult(data.data)
        if (data.data.won) {
          soundEffects.playByName('chime')
          toast.success(data.data.message)
        } else {
          toast.info(data.data.message)
        }
        loadGames()
      } else {
        toast.error(data.error || 'Could not open the crate')
      }
    } catch {
      toast.error('Could not reach the games service')
    } finally {
      setCrateBusy(false)
    }
  }

  const glyphFor = (id: string) => (id === 'wholesale_trivia' ? <Brain className="w-5 h-5" /> : id === 'memory_match' ? <Layers className="w-5 h-5" /> : <Package className="w-5 h-5" />)

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition" aria-label="Go back">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-red-600" />
            <h1 className="font-bold text-gray-900 text-base">Gamified Rewards</h1>
          </div>
        </div>
        <button
          onClick={() => navigate('game-history')}
          className="flex items-center gap-1 text-xs font-bold text-red-600 hover:underline"
        >
          <History className="w-3.5 h-3.5" /> High Scores
        </button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto lg:max-w-5xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-3xl p-6 text-white shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-100">
            <Sparkles className="w-4 h-4 text-amber-300" /> Play &amp; Earn Wholesale Points
          </div>
          <h2 className="text-base sm:text-lg font-bold">Real Games, Real Grading, Real Points</h2>
          <p className="text-xs text-rose-100">
            Every score is earned against the server — questions are graded, sequences are dealt, crates are sealed before you open them. Points redeem for real order discounts.
          </p>
        </div>

        {/* QUIZ — active paper */}
        {quiz && (
          <div className="bg-white rounded-3xl p-5 border-2 border-red-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Brain className="w-4 h-4 text-red-600" /> B2B Wholesale Master Quiz</h3>
              <Badge variant="outline" className="text-[10px]">{Object.keys(quiz.answers).length}/{quiz.questions.length} answered</Badge>
            </div>
            <Progress value={Math.round((Object.keys(quiz.answers).length / quiz.questions.length) * 100)} className="h-1.5" aria-label="Quiz progress" />
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {quiz.questions.map((q, qi) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-xs font-semibold text-gray-800">{qi + 1}. {q.q}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => {
                      const selected = quiz.answers[q.id] === oi
                      return (
                        <button
                          key={oi}
                          onClick={() => setQuiz({ ...quiz, answers: { ...quiz.answers, [q.id]: oi } })}
                          className={`text-left text-[11px] px-3 py-2 rounded-xl border transition ${selected ? 'border-red-400 bg-red-50 font-bold text-red-800' : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'}`}
                          aria-pressed={selected}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setQuiz(null)} className="w-1/2 rounded-xl text-xs font-bold">Cancel</Button>
              <Button onClick={submitQuiz} disabled={quizBusy} className="w-1/2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold">
                {quizBusy ? 'Grading…' : 'Submit for grading'}
              </Button>
            </div>
          </div>
        )}

        {quizResult && !quiz && (
          <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-md space-y-1 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
            <p className="text-sm font-bold text-gray-900">{quizResult.correct}/{quizResult.total} correct</p>
            <p className="text-xs text-emerald-700 font-bold">+{quizResult.pointsWon} loyalty points</p>
            <p className="text-[11px] text-gray-500">{quizResult.message}</p>
          </div>
        )}

        {/* MEMORY — active round */}
        {mem && (
          <div className="bg-white rounded-3xl p-5 border-2 border-emerald-200 shadow-xl space-y-4 text-center">
            <h3 className="text-sm font-bold text-gray-900 flex items-center justify-center gap-2"><Layers className="w-4 h-4 text-emerald-600" /> Factory Cargo Matcher</h3>
            {mem.phase === 'flash' ? (
              <div className="space-y-3 py-4">
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1"><Timer className="w-3.5 h-3.5" /> Memorize the cargo order…</p>
                <div className="flex items-center justify-center gap-2 min-h-16">
                  {mem.sequence.map((sym, i) => (
                    <span
                      key={i}
                      className={`text-3xl transition-opacity duration-300 ${i <= mem.shownIndex ? 'opacity-100' : 'opacity-0'}`}
                      role="img"
                      aria-label={`cargo ${i + 1}`}
                    >
                      {MEMORY_SYMBOL_GLYPHS[sym] ?? '📦'}
                    </span>
                  ))}
                </div>
              </div>
            ) : mem.phase === 'input' ? (
              <div className="space-y-3 py-2">
                <p className="text-xs text-gray-500">Reproduce the order ({mem.picked.length}/{mem.sequence.length})</p>
                <div className="flex items-center justify-center gap-1.5 min-h-10 flex-wrap">
                  {mem.picked.map((sym, i) => <span key={i} className="text-2xl" role="img" aria-label={`picked ${i + 1}`}>{MEMORY_SYMBOL_GLYPHS[sym] ?? '📦'}</span>)}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(MEMORY_SYMBOL_GLYPHS).map(([sym, glyph]) => (
                    <button
                      key={sym}
                      onClick={() => pickSymbol(sym)}
                      className="text-2xl py-2.5 rounded-xl border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition"
                      aria-label={`pick ${sym}`}
                    >
                      {glyph}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {memResult && !mem && (
          <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-md space-y-1 text-center">
            {memResult.correct === memResult.total ? <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" /> : <XCircle className="w-8 h-8 mx-auto text-amber-600" />}
            <p className="text-sm font-bold text-gray-900">{memResult.correct}/{memResult.total} positions matched</p>
            <p className="text-xs text-emerald-700 font-bold">+{memResult.pointsWon} loyalty points</p>
            <p className="text-[11px] text-gray-500">Dealt order: {memResult.dealt.map((s) => MEMORY_SYMBOL_GLYPHS[s] ?? '📦').join(' ')}</p>
          </div>
        )}

        {/* CRATE result */}
        {crateResult && (
          <div className={`bg-white rounded-3xl p-5 border shadow-md space-y-1 text-center ${crateResult.won ? 'border-amber-300' : 'border-gray-200'}`}>
            {crateResult.won ? <Gift className="w-8 h-8 mx-auto text-amber-600" /> : <Package className="w-8 h-8 mx-auto text-gray-300" />}
            <p className="text-sm font-bold text-gray-900">{crateResult.won ? `৳${crateResult.prize?.value} OFF voucher won!` : 'Packing straw'}</p>
            {crateResult.won && crateResult.prize && <p className="text-xs font-mono text-gray-600">{crateResult.prize.code}</p>}
            <p className="text-[11px] text-gray-500">{crateResult.message}</p>
          </div>
        )}

        {/* Games grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Available Games</h3>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-3xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {games.map((g) => {
                const used = usage?.[g.id] ?? 0
                const exhausted = used >= g.dailyLimit
                return (
                  <div key={g.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col gap-3 hover:border-red-200 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white shadow-sm" style={{ backgroundColor: g.color || '#B91C1C' }}>
                          {glyphFor(g.id)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-gray-900">{g.title}</h4>
                            <Badge variant="outline" className="text-[10px] border-red-200 text-red-700">{g.reward}</Badge>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{g.desc}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {token && usage ? (
                        <div className="flex-1 min-w-0">
                          <Progress value={Math.min(100, Math.round((used / g.dailyLimit) * 100))} className="h-1.5" aria-label={`Daily attempts ${used} of ${g.dailyLimit}`} />
                          <p className="text-[10px] text-gray-400 mt-1">{used} of {g.dailyLimit} used today</p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 flex-1">{g.dailyLimit} rounds per day</p>
                      )}
                      {g.id === 'wholesale_trivia' && (
                        <Button size="sm" onClick={startQuiz} disabled={quizBusy || exhausted} className="h-9 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl flex-shrink-0 gap-1 shadow-sm">
                          <Play className="w-3.5 h-3.5 fill-white" /> {exhausted ? 'Done today' : 'Play'}
                        </Button>
                      )}
                      {g.id === 'memory_match' && (
                        <Button size="sm" onClick={startMemory} disabled={exhausted || (!!mem && mem.phase !== 'done')} className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex-shrink-0 gap-1 shadow-sm">
                          <Play className="w-3.5 h-3.5 fill-white" /> {exhausted ? 'Done today' : 'Play'}
                        </Button>
                      )}
                      {g.id === 'box_picker' && (
                        <Button size="sm" onClick={openCrate} disabled={crateBusy || exhausted} className="h-9 px-4 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex-shrink-0 gap-1 shadow-sm">
                          <Package className="w-3.5 h-3.5" /> {exhausted ? 'Done today' : crateBusy ? 'Opening…' : 'Open crate'}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MiniGamesPage
