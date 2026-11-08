'use client'

/* ══════════════════════════════════════════════════════════════════════
   Search History store (t293) — the guest half of the search-history
   circuit. t292 wired the BUYER circuit end-to-end (server POST writer +
   seven reader surfaces), but every reader is account-scoped, so a
   guest's searches vanished without a trace: no rail, no history page,
   nothing. This store gives guests an HONEST history — their own
   searches, on their own device — exactly the doctrine t291 established
   for Recently Viewed (buyers → the real server table, guests → the
   device-local store; neither audience ever sees a fabricated list).

   Design (mirrors use-recently-viewed.ts):
   • localStorage `zylod:search-history:v1` — newest first, deduped by
     (searchType + lowercased query), capped at MAX_SEARCH_HISTORY (12).
   • Cross-component sync via a window CustomEvent + the `storage`
     event, so recording a search on the results page updates the
     search-home rail live.
   • SSR-safe: reads happen inside effects only; the server render sees
     an empty list — zero hydration mismatch surface.
   • Every persisted row is validated on read; malformed or hand-edited
     entries are dropped, never rendered.
   • Signing in switches readers to the server history (the account's
     own rows); the device-local rows are never merged into the account
     — no second source of truth, per the Task 104 doctrine.
   ══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'zylod:search-history:v1'
const CHANGE_EVENT = 'zylod:search-history-changed'
export const MAX_SEARCH_HISTORY = 12

const VALID_TYPES = ['text', 'voice', 'image', 'qr', 'barcode'] as const
export type SearchType = (typeof VALID_TYPES)[number]

export interface SearchHistoryItem {
  /** Stable identity: `${searchType}:${lowercased query}` — also the dedup key. */
  id: string
  query: string
  searchType: SearchType
  resultCount: number
  searchedAt: number
}

function isSearchType(v: unknown): v is SearchType {
  return typeof v === 'string' && (VALID_TYPES as readonly string[]).includes(v)
}

/** Narrow validator — one bad row (or hand-edited localStorage) must
 *  never break a rail. Required: non-empty query (≤120 chars), known
 *  type, finite counts. */
function isValidItem(v: unknown): v is SearchHistoryItem {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    typeof r.query === 'string' &&
    r.query.trim().length > 0 &&
    r.query.length <= 120 &&
    isSearchType(r.searchType) &&
    typeof r.resultCount === 'number' &&
    Number.isFinite(r.resultCount) &&
    r.resultCount >= 0 &&
    typeof r.searchedAt === 'number' &&
    Number.isFinite(r.searchedAt)
  )
}

function readStore(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidItem)
  } catch {
    return []
  }
}

function writeStore(items: SearchHistoryItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Quota errors / private-mode restrictions: history is best-effort
    // by design — the rails just stay empty rather than erroring.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

export interface RecordSearchInput {
  query: string
  searchType?: string
  resultCount?: number
}

/** Record one search. Re-recording the same (type, query) pair bumps it
 *  to the front and refreshes searchedAt/resultCount instead of
 *  duplicating the row. Guests only — buyers record server-side
 *  (POST /api/search/history) and never touch this store. */
export function recordSearch({ query, searchType, resultCount }: RecordSearchInput) {
  if (typeof window === 'undefined') return
  const q = typeof query === 'string' ? query.trim().slice(0, 120) : ''
  if (!q) return
  const type: SearchType = isSearchType(searchType) ? searchType : 'text'
  const count = typeof resultCount === 'number' && Number.isFinite(resultCount) && resultCount >= 0 ? Math.floor(resultCount) : 0
  const id = `${type}:${q.toLowerCase()}`
  const rest = readStore().filter((i) => i.id !== id)
  writeStore([{ id, query: q, searchType: type, resultCount: count, searchedAt: Date.now() }, ...rest].slice(0, MAX_SEARCH_HISTORY))
}

/** Subscribe to the guest history. `items` is [] during SSR and the
 *  first client render, then hydrates from localStorage in an effect. */
export function useSearchHistory(filterType?: SearchType | 'all') {
  const [items, setItems] = useState<SearchHistoryItem[]>([])

  useEffect(() => {
    const sync = () => setItems(readStore())
    sync()
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const clear = useCallback(() => {
    writeStore([])
  }, [])

  const remove = useCallback((id: string) => {
    writeStore(readStore().filter((i) => i.id !== id))
  }, [])

  const filtered = filterType && filterType !== 'all' ? items.filter((i) => i.searchType === filterType) : items

  return { items: filtered, clear, remove }
}
