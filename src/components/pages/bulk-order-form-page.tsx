'use client'

/**
 * Bulk Order Form — REAL wholesale bulk builder (id: 'bulk-order-form').
 *
 * Every product, variant, tier, and stock number here comes from the real
 * APIs:
 *   - GET /api/products?search=&category=&page=&limit=  (approved+active only;
 *     NOTE the route's filter param is `category` with a category SLUG — there
 *     is no `categoryId` param on this route)
 *   - GET /api/categories
 *
 * Pricing preview uses the canonical client rule (variant priceOverride →
 * covering tier → basePrice) via resolveClientUnitPrice from the cart store.
 *
 * SUBMIT (Task 55-a migration): ONE POST /api/cart/bulk with
 * credentials:'include' — the repaired transactional bulk endpoint (Task
 * 51-d), not the old optimistic addItem-per-line flow. Quantities leave the
 * client as NUMBERS (kg decimals are legal, normalized to 2 dp — no
 * parseInt/string stripping anywhere in the submit path). The endpoint is
 * buyer-only (401 first), rate-limited, re-checks MOQ / maxOrderQty / stock
 * on the MERGED line server-side, merges duplicate (productId, variantId)
 * lines with +=, and re-prices every cart line with the canonical resolver.
 *
 * The response carries REAL per-item outcomes at the TOP level
 * (`results: [{ productId, variantId, status: 'added' | 'merged' |
 * 'rejected', quantity, previousQuantity?, reason?, details? }]` plus a
 * verbatim `message` like "2 added, 1 merged, 1 rejected"). They are rendered
 * honestly per line: added / merged (previous → new) / rejected with the
 * server's own reason. Rejected rows stay in the builder for fixing; rows the
 * server accepted are removed. Toasts fire on real 2xx only; 400/401/4xx
 * surface the verbatim server error; a real 401 raises the sign-in gate
 * (navigate('login') — the same pattern other buyer pages use). After a
 * 2xx with accepted lines the header cart badge is refreshed via
 * syncWithApi(user.id) — the same cart-store mechanism every other
 * cart-touching page relies on.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'
import { useCartStore, resolveClientUnitPrice, type ClientPriceTier } from '@/store/cart-store'
import {
  Search, ShoppingCart, Package, Plus, Trash2, Tag,
  Loader2, AlertTriangle, LogIn, RotateCcw, LayoutGrid, Layers,
  CheckCircle2, XCircle, Combine,
} from 'lucide-react'

/* ─── Server limit mirrored from the bulk contract (Zod .max(50)) ─── */
const BULK_MAX_ITEMS = 50

/** 2-dp normalizer — mirrors roundQty from the bulk endpoint (float drift
 * from decimal typing must never reach the wire or the DB). */
function roundQty2(q: number): number {
  return Math.round(q * 100) / 100
}

/* ─── Real API shapes ─── */

interface ApiVariant {
  id: string
  variantName: string
  variantValue: string
  stockQuantity: number
  priceOverride: number | null
}

interface CatalogProduct {
  id: string
  name: string
  slug: string
  unit: string
  moq: number
  maxOrderQty: number | null
  basePrice: number
  stockQuantity: number
  thumbnailUrl: string | null
  supplierId: string
  supplierName: string
  imageUrl: string | null
  priceTiers: ClientPriceTier[]
  variants: ApiVariant[]
}

function normalizeProduct(raw: Record<string, unknown>): CatalogProduct {
  const supplier = raw.supplier as { id?: string; companyName?: string } | undefined
  const images = raw.images as { imageUrl?: string }[] | undefined
  const tiers = raw.priceTiers as ClientPriceTier[] | undefined
  const variants = raw.variants as ApiVariant[] | undefined
  return {
    id: (raw.id as string) ?? '',
    name: (raw.name as string) ?? '',
    slug: (raw.slug as string) ?? '',
    unit: (raw.unit as string) ?? 'pcs',
    moq: (raw.moq as number) ?? 1,
    maxOrderQty: (raw.maxOrderQty as number | null) ?? null,
    basePrice: (raw.basePrice as number) ?? 0,
    stockQuantity: (raw.stockQuantity as number) ?? 0,
    thumbnailUrl: (raw.thumbnailUrl as string | null) ?? null,
    supplierId: (raw.supplierId as string) ?? supplier?.id ?? '',
    supplierName: supplier?.companyName ?? '',
    imageUrl: (raw.thumbnailUrl as string | null) ?? (images?.[0]?.imageUrl as string | undefined) ?? null,
    priceTiers: Array.isArray(tiers)
      ? tiers
          .map((t) => ({ minQty: t.minQty, maxQty: t.maxQty ?? null, pricePerUnit: t.pricePerUnit }))
          .sort((a, b) => a.minQty - b.minQty)
      : [],
    variants: Array.isArray(variants) ? variants : [],
  }
}

interface CategoryOption {
  id: string
  name: string
  slug: string
}

interface BuildRow {
  key: string
  product: CatalogProduct
  /** Raw decimal-safe text of the quantity input (kg lines accept "2.5").
   * The numeric value is parsed on demand — never parseInt-stripped. */
  qtyText: string
  variantId: string | null
}

/* ─── Real per-item outcome shapes from POST /api/cart/bulk (top-level
 * `results` in the response — see src/app/api/cart/bulk/route.ts) ─── */

interface BulkResultRaw {
  productId?: string
  variantId?: string | null
  status?: 'added' | 'merged' | 'rejected'
  quantity?: number
  previousQuantity?: number
  reason?: string
}

interface OutcomeView {
  key: string
  productId: string
  name: string
  unit: string
  variantLabel: string | null
  status: 'added' | 'merged' | 'rejected'
  quantity: number
  previousQuantity?: number
  reason?: string
}

function bestTierOf(tiers: ClientPriceTier[]): ClientPriceTier | null {
  if (tiers.length === 0) return null
  return tiers.reduce((best, t) => (t.pricePerUnit < best.pricePerUnit ? t : best))
}

export function BulkOrderFormPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { syncWithApi } = useCartStore()
  const { user } = useAuthStore()

  /* ─── Catalog discovery state ─── */
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogStatus, setCatalogStatus] = useState<number | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  /* ─── Builder state ─── */
  const [rows, setRows] = useState<BuildRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [authGate, setAuthGate] = useState<{ message: string } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<OutcomeView[] | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        const cats = Array.isArray(data?.data) ? data.data : []
        setCategories(
          cats.map((c: Record<string, unknown>) => ({
            id: (c.id as string) ?? '',
            name: (c.name as string) ?? '',
            slug: (c.slug as string) ?? '',
          }))
        )
      }
    } catch {
      // Category filter is optional — the search itself still works.
    }
  }, [])

  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    setCatalogStatus(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (activeSearch.trim()) params.set('search', activeSearch.trim())
      if (categorySlug) params.set('category', categorySlug)
      const res = await fetch(`/api/products?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data.map(normalizeProduct) : []
        setCatalog((prev) => (page > 1 ? [...prev, ...items] : items))
        setTotalPages(
          data?.pagination?.totalPages && Number(data.pagination.totalPages) > 0
            ? Number(data.pagination.totalPages)
            : 1
        )
      } else {
        setCatalogError(`Product catalog failed (HTTP ${res.status}). Try again.`)
        setCatalogStatus(res.status)
        setCatalog([])
      }
    } catch {
      setCatalogError('Could not reach the product catalog. Check your connection and try again.')
      setCatalog([])
    } finally {
      setCatalogLoading(false)
    }
  }, [activeSearch, categorySlug, page])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog, retryToken])

  /* ─── Row management ─── */

  const addRow = useCallback((product: CatalogProduct) => {
    const key = `${product.id}::base`
    setRows((prev) => {
      if (prev.some((r) => r.key === key)) {
        toast.info('Already in your bulk list', { description: product.name })
        return prev
      }
      if (prev.length >= BULK_MAX_ITEMS) {
        toast.error(`Bulk list is limited to ${BULK_MAX_ITEMS} lines per request`)
        return prev
      }
      return [
        ...prev,
        {
          key,
          product,
          qtyText: String(product.moq),
          variantId: null,
        },
      ]
    })
    toast.success('Added to bulk list', { description: `${product.name} · MOQ ${product.moq} ${product.unit}` })
  }, [])

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }, [])

  /** Decimal-safe quantity typing: keep digits and ONE dot ("2.5" stays
   * "2.5") — mirrors the cart-page handleQtyInput pattern from the kg round.
   * No parseInt, no Math.floor. */
  const setRowQtyText = useCallback((key: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, qtyText: cleaned } : r)))
  }, [])

  /** On blur: normalize the text to a real 2-dp quantity (≥ MOQ) or reset to
   * the product MOQ when nothing usable was typed. */
  const normalizeRowQty = useCallback((key: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const parsed = parseFloat(r.qtyText)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return { ...r, qtyText: String(r.product.moq) }
        }
        const clamped = Math.max(roundQty2(parsed), r.product.moq)
        return { ...r, qtyText: String(clamped) }
      })
    )
  }, [])

  const setRowVariant = useCallback((key: string, variantId: string | null) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, variantId } : r)))
  }, [])

  /** Numeric quantity of a row, parsed from its decimal-safe text. */
  const rowQuantity = useCallback((row: BuildRow): number => {
    return parseFloat(row.qtyText)
  }, [])

  /* ─── Canonical pricing per row ─── */

  const rowPrice = useCallback(
    (row: BuildRow) => {
      const quantity = rowQuantity(row)
      const variant = row.variantId ? row.product.variants.find((v) => v.id === row.variantId) : null
      const unitPrice = resolveClientUnitPrice({
        basePrice: row.product.basePrice,
        variantPriceOverride: variant?.priceOverride ?? null,
        priceTiers: row.product.priceTiers,
        quantity: Number.isFinite(quantity) ? quantity : 0,
      })
      return { unitPrice, totalPrice: unitPrice * quantity }
    },
    [rowQuantity]
  )

  const rowLimit = useCallback((row: BuildRow) => {
    if (row.variantId) {
      const variant = row.product.variants.find((v) => v.id === row.variantId)
      if (variant) return variant.stockQuantity
    }
    return row.product.stockQuantity
  }, [])

  const rowError = useCallback(
    (row: BuildRow): string | null => {
      const { product } = row
      const quantity = rowQuantity(row)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return 'Enter a quantity.'
      }
      if (product.maxOrderQty != null && product.moq > product.maxOrderQty) {
        return `Unorderable: MOQ (${product.moq}) is above the max order quantity (${product.maxOrderQty}).`
      }
      if (quantity < product.moq) {
        return `Below MOQ — minimum ${product.moq} ${product.unit}.`
      }
      if (product.maxOrderQty != null && quantity > product.maxOrderQty) {
        return `Above the max order quantity (${product.maxOrderQty} ${product.unit}).`
      }
      const stock = rowLimit(row)
      if (quantity > stock) {
        return `Only ${stock.toLocaleString()} ${product.unit} in stock${row.variantId ? ' for this variant' : ''}.`
      }
      return null
    },
    [rowQuantity, rowLimit]
  )

  const { grandTotal, totalUnits, allValid } = useMemo(() => {
    let grandTotal = 0
    let totalUnits = 0
    let allValid = rows.length > 0
    for (const row of rows) {
      const quantity = rowQuantity(row)
      if (Number.isFinite(quantity)) {
        totalUnits += quantity
        grandTotal += rowPrice(row).totalPrice
      }
      if (rowError(row)) allValid = false
    }
    return { grandTotal, totalUnits, allValid }
  }, [rows, rowPrice, rowError, rowQuantity])

  /* ─── Submit: ONE real POST /api/cart/bulk ─── */

  const handleSubmit = useCallback(async () => {
    if (submitting || rows.length === 0) return
    setSubmitError(null)
    setOutcomes(null)

    const invalid = rows.filter((r) => rowError(r))
    if (invalid.length > 0) {
      toast.error('Fix the highlighted lines first', {
        description: invalid.map((r) => r.product.name).join(', '),
      })
      return
    }

    setSubmitting(true)
    try {
      // Quantities leave as NUMBERS (kg decimals legal, 2 dp) — the server
      // re-validates MOQ/max/stock on the MERGED line and re-prices.
      const payload = {
        items: rows.map((row) => ({
          productId: row.product.id,
          variantId: row.variantId ?? null,
          quantity: roundQty2(rowQuantity(row)),
        })),
      }

      const res = await fetch('/api/cart/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => null)

      // Real 401 → sign-in gate (same navigate('login') pattern as other
      // buyer pages). The verbatim server reason is shown.
      if (res.status === 401) {
        setAuthGate({ message: body?.error || 'Authentication required' })
        return
      }

      // Verbatim server errors on failure (400 Zod / 429 / 5xx / 409-class).
      if (!res.ok || !body?.success) {
        const fieldErrors = body?.fieldErrors as Record<string, string[]> | undefined
        const flat = fieldErrors
          ? Object.entries(fieldErrors)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join('; ') : String(msgs)}`)
              .join(' — ')
          : ''
        setSubmitError(
          [body?.error || `Bulk add failed (HTTP ${res.status}).`, flat].filter(Boolean).join(' — ')
        )
        return
      }

      // 2xx — REAL per-item outcomes (top-level results[] of the bulk
      // contract). Never assume success for any line.
      const rawResults: BulkResultRaw[] = Array.isArray(body.results) ? body.results : []
      const views: OutcomeView[] = rawResults.map((r) => {
        const row = rows.find(
          (rr) => rr.product.id === r.productId && (rr.variantId ?? null) === (r.variantId ?? null)
        )
        const variant = row?.variantId ? row.product.variants.find((v) => v.id === row.variantId) : null
        return {
          key: `${r.productId ?? '?'}::${r.variantId ?? ''}`,
          productId: r.productId ?? '?',
          name: row?.product.name || r.productId || 'Unknown product',
          unit: row?.product.unit || '',
          variantLabel: variant ? `${variant.variantName}: ${variant.variantValue}` : null,
          status: r.status === 'added' || r.status === 'merged' || r.status === 'rejected' ? r.status : 'rejected',
          quantity: typeof r.quantity === 'number' ? r.quantity : 0,
          previousQuantity: r.previousQuantity,
          reason: r.reason,
        }
      })
      setOutcomes(views)

      const rejectedViews = views.filter((v) => v.status === 'rejected')
      const acceptedViews = views.filter((v) => v.status !== 'rejected')

      // Rows the server accepted leave the builder; rejected rows stay so
      // the buyer can fix exactly what failed.
      const rejectedRowKeys = new Set(rejectedViews.map((v) => `${v.productId}::base`))
      setRows((prev) => prev.filter((r) => rejectedRowKeys.has(r.key)))

      // Refresh the header cart badge/count from server truth — the same
      // cart-store sync mechanism every other cart-touching page uses.
      if (acceptedViews.length > 0 && user?.id) {
        await syncWithApi(user.id)
      }

      // Toast on real 2xx only. The title is the server's own verbatim
      // summary ("X added, Y merged, Z rejected").
      if (rejectedViews.length === 0) {
        const totalItems = typeof body?.data?.totalItems === 'number' ? body.data.totalItems : undefined
        const totalAmount = typeof body?.data?.totalAmount === 'number' ? body.data.totalAmount : undefined
        toast.success(body?.message || 'Bulk order added to cart', {
          description:
            totalItems != null && totalAmount != null
              ? `Cart now: ${totalItems} line${totalItems === 1 ? '' : 's'} · ${formatPrice(totalAmount)}`
              : undefined,
        })
        navigate('cart')
      } else {
        toast.warning(`${rejectedViews.length} of ${views.length} line(s) rejected`, {
          description: rejectedViews[0]?.reason || body?.message,
        })
      }
    } catch {
      setSubmitError('Could not reach the bulk cart service. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }, [submitting, rows, rowError, rowQuantity, user?.id, syncWithApi, navigate, formatPrice])

  const bestTier = (p: CatalogProduct) => bestTierOf(p.priceTiers)
  const tierSavings = (p: CatalogProduct) => {
    const bt = bestTier(p)
    if (!bt || p.basePrice <= 0 || bt.pricePerUnit >= p.basePrice) return null
    return {
      percent: Math.round(((p.basePrice - bt.pricePerUnit) / p.basePrice) * 100),
      minQty: bt.minQty,
      price: bt.pricePerUnit,
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-10 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:px-6">
        <div className="md:max-w-6xl md:mx-auto">
          <h1 className="text-base md:text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Bulk Order Builder
          </h1>
          <p className="text-[11px] md:text-xs text-slate-500 mt-0.5">
            Mix products into one wholesale order — every line shows unit, MOQ, and volume-tier savings. Decimals allowed for kg lines.
          </p>
        </div>
      </header>

      <main className="px-4 py-4 space-y-5 max-w-lg mx-auto md:max-w-6xl md:px-6 md:py-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        {/* ─── Product finder ─── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 lg:col-span-2 order-2 lg:order-1">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setPage(1)
              setActiveSearch(searchInput.trim())
            }}
            className="relative flex items-center"
          >
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search the wholesale catalog…"
              aria-label="Search catalog products"
              className="pl-10 pr-4 h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium focus-visible:ring-primary"
            />
          </form>

          {/* Category filter — real slugs from GET /api/categories */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1">
              <button
                onClick={() => { setPage(1); setCategorySlug('') }}
                className={`shrink-0 min-h-11 px-3 rounded-full text-xs font-bold border transition-colors ${
                  categorySlug === ''
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-primary'
                }`}
              >
                All categories
              </button>
              {categories.slice(0, 10).map((c) => (
                <button
                  key={c.id || c.slug}
                  onClick={() => { setPage(1); setCategorySlug(c.slug) }}
                  className={`shrink-0 min-h-11 px-3 rounded-full text-xs font-bold border transition-colors ${
                    categorySlug === c.slug
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Catalog results */}
          <div className="mt-4">
            {catalogLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="border border-slate-100 rounded-2xl p-3 flex gap-3">
                    <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-11 w-20 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : catalogError ? (
              <div className="text-center py-10 border border-slate-100 rounded-2xl">
                <AlertTriangle className="h-10 w-10 mx-auto text-primary mb-2" />
                <p className="text-sm font-bold text-slate-800">{catalogError}</p>
                {catalogStatus ? <p className="text-xs text-slate-400 mt-0.5">HTTP {catalogStatus} from /api/products</p> : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 min-h-11 text-xs font-semibold text-primary border-primary"
                  onClick={() => setRetryToken((t) => t + 1)}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : catalog.length === 0 ? (
              <div className="text-center py-10 border border-slate-100 rounded-2xl">
                <Package className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-800">No products found</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {activeSearch || categorySlug
                    ? 'Nothing matches this search or category yet. Try different terms.'
                    : 'The wholesale catalog is empty right now. Check back soon.'}
                </p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {catalog.map((p) => {
                    const savings = tierSavings(p)
                    const outOfStock = p.stockQuantity <= 0 && p.variants.every((v) => v.stockQuantity <= 0)
                    return (
                      <li key={p.id} className="py-3 flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-6 w-6 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 line-clamp-1">{p.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {formatPrice(p.basePrice)}/{p.unit} · MOQ {p.moq.toLocaleString()} {p.unit}
                            {p.variants.length > 0 ? ` · ${p.variants.length} variant${p.variants.length === 1 ? '' : 's'}` : ''}
                          </p>
                          {savings ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5 mt-1">
                              <Tag className="h-2.5 w-2.5" />
                              Save {savings.percent}% at {savings.minQty.toLocaleString()}+ {p.unit}
                            </span>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addRow(p)}
                          disabled={outOfStock}
                          className="min-h-11 px-3 text-xs font-bold rounded-xl shrink-0"
                          title={outOfStock ? 'Out of stock' : `Add ${p.name} to the bulk list`}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </li>
                    )
                  })}
                </ul>
                {page < totalPages && (
                  <div className="pt-3 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-xs font-semibold text-primary border-primary"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Load more products (page {page + 1} of {totalPages})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ─── Order summary ─── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3 order-1 lg:order-2 lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Your Bulk Order</h2>
            </div>
            <span className="text-[11px] text-slate-400">
              {rows.length} line{rows.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Auth gate — the REAL 401 from POST /api/cart/bulk */}
          {authGate && (
            <div className="rounded-xl border border-primary/30 bg-red-50 p-4 text-center space-y-2">
              <LogIn className="h-6 w-6 mx-auto text-primary" />
              <p className="text-xs font-bold text-slate-800">Sign in to add to your cart</p>
              <p className="text-[11px] text-slate-600">
                The bulk cart API answered: &ldquo;{authGate.message}&rdquo; — cart persistence requires a buyer account.
              </p>
              <Button
                className="w-full min-h-11 text-xs font-bold rounded-xl"
                onClick={() => navigate('login')}
              >
                Sign In
              </Button>
              <button
                className="text-[11px] font-semibold text-slate-500 hover:text-primary min-h-11"
                onClick={() => setAuthGate(null)}
              >
                Keep editing without an account
              </button>
            </div>
          )}

          {submitError && (
            <div className="rounded-xl border border-primary/30 bg-red-50 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-slate-700">{submitError}</p>
            </div>
          )}

          {/* Per-item server outcomes — the REAL results[] of the last bulk
              submit, rendered honestly per line. */}
          {outcomes && outcomes.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Server outcomes — last submit
                </p>
                <button
                  className="text-[11px] font-semibold text-slate-500 hover:text-primary min-h-11 px-2"
                  onClick={() => setOutcomes(null)}
                >
                  Dismiss
                </button>
              </div>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                {outcomes.map((o) => (
                  <li key={o.key} className="flex items-start gap-2 text-[11px] leading-snug">
                    {o.status === 'added' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    ) : o.status === 'merged' ? (
                      <Combine className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 line-clamp-1">{o.name}</p>
                      {o.status === 'added' && (
                        <p className="text-slate-600">
                          Added to cart — {o.quantity.toLocaleString()} {o.unit}
                          {o.variantLabel ? ` · ${o.variantLabel}` : ''}
                        </p>
                      )}
                      {o.status === 'merged' && (
                        <p className="text-slate-600">
                          Merged into your existing cart line —{' '}
                          {(o.previousQuantity ?? 0).toLocaleString()} → {o.quantity.toLocaleString()} {o.unit}
                          {o.variantLabel ? ` · ${o.variantLabel}` : ''}
                        </p>
                      )}
                      {o.status === 'rejected' && (
                        <p className="text-primary">
                          Rejected — {o.reason || 'no reason given'}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {outcomes.some((o) => o.status !== 'rejected') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full min-h-11 text-xs font-semibold text-primary border-primary"
                  onClick={() => navigate('cart')}
                >
                  <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> View cart
                </Button>
              )}
            </div>
          )}

          {rows.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
              <Package className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-700">No lines yet</p>
              <p className="text-[11px] text-slate-500 mt-1 px-4">
                Search above and press &ldquo;Add&rdquo; to start building a multi-product wholesale order.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto -mx-1 px-1">
              {rows.map((row) => {
                const { unitPrice, totalPrice } = rowPrice(row)
                const error = rowError(row)
                const savings = tierSavings(row.product)
                const variant = row.variantId ? row.product.variants.find((v) => v.id === row.variantId) : null
                return (
                  <li key={row.key} className="py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                        {row.product.imageUrl ? (
                          <img src={row.product.imageUrl} alt={row.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 line-clamp-1">{row.product.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {row.product.supplierName ? `${row.product.supplierName} · ` : ''}
                          MOQ {row.product.moq.toLocaleString()} {row.product.unit}
                          {row.product.maxOrderQty != null ? ` · max ${row.product.maxOrderQty.toLocaleString()}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => removeRow(row.key)}
                        aria-label={`Remove ${row.product.name} from bulk list`}
                        className="h-11 w-11 flex items-center justify-center text-slate-400 hover:text-primary shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Variant picker — real stock + real priceOverride */}
                    {row.product.variants.length > 0 && (
                      <select
                        value={row.variantId ?? ''}
                        onChange={(e) => setRowVariant(row.key, e.target.value || null)}
                        aria-label={`Variant for ${row.product.name}`}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Base product (no variant)</option>
                        {row.product.variants.map((v) => (
                          <option key={v.id} value={v.id} disabled={v.stockQuantity <= 0}>
                            {v.variantName}: {v.variantValue} — {v.stockQuantity.toLocaleString()} in stock
                            {v.priceOverride != null ? ` @ ${formatPrice(v.priceOverride)}` : ''}
                            {v.stockQuantity <= 0 ? ' (out of stock)' : ''}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label
                          htmlFor={`qty-${row.key}`}
                          className="text-[10px] font-bold text-slate-400 uppercase"
                        >
                          Quantity ({row.product.unit})
                        </label>
                        <Input
                          id={`qty-${row.key}`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder={String(row.product.moq)}
                          value={row.qtyText}
                          onChange={(e) => setRowQtyText(row.key, e.target.value)}
                          onBlur={() => normalizeRowQty(row.key)}
                          aria-label={`Quantity in ${row.product.unit} for ${row.product.name}`}
                          className="h-11 mt-0.5 text-sm font-bold rounded-xl bg-slate-50 border-slate-200"
                        />
                      </div>
                      <div className="text-right pb-0.5">
                        <p className="text-[10px] text-slate-400 font-medium">
                          {formatPrice(unitPrice)}/{row.product.unit}
                        </p>
                        <p className="text-sm font-black text-slate-900">{formatPrice(totalPrice)}</p>
                      </div>
                    </div>

                    {/* Volume tier strip — REAL tiers of THIS product */}
                    {row.product.priceTiers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {row.product.priceTiers.slice(0, 3).map((t, i) => {
                          const quantity = rowQuantity(row)
                          const active =
                            Number.isFinite(quantity) &&
                            quantity >= t.minQty &&
                            (t.maxQty == null || quantity <= t.maxQty)
                          return (
                            <span
                              key={`${row.key}-tier-${i}`}
                              className={`text-[9px] font-bold rounded-md px-1.5 py-0.5 ${
                                active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {t.minQty.toLocaleString()}
                              {t.maxQty != null ? `–${t.maxQty.toLocaleString()}` : '+'} {row.product.unit}: {formatPrice(t.pricePerUnit)}
                            </span>
                          );
                        })}
                        {savings ? (
                          <span className="text-[9px] font-bold rounded-md px-1.5 py-0.5 bg-emerald-50 text-emerald-700">
                            Save {savings.percent}% at {savings.minQty.toLocaleString()}+ {row.product.unit}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {error ? (
                      <p className="text-[10px] font-bold text-primary bg-red-50 rounded-md px-2 py-1">{error}</p>
                    ) : null}
                    {variant && variant.priceOverride != null && !error ? (
                      <p className="text-[10px] text-slate-500">
                        Variant price: {formatPrice(variant.priceOverride)}/{row.product.unit} (volume tiers don&apos;t apply to variants).
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}

          {/* Totals */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>Total quantity</span>
              <span className="font-bold text-slate-800">{totalUnits.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-800">Grand total</span>
              <span className="text-lg font-black text-slate-900">{formatPrice(grandTotal)}</span>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || rows.length === 0 || !allValid}
            className="w-full min-h-11 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Adding to cart…
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Add {rows.length > 0 ? `${rows.length} line${rows.length === 1 ? '' : 's'} to cart` : 'to cart'}
              </>
            )}
          </Button>
          {rows.length > 0 && !allValid && (
            <p className="text-[10px] text-slate-400 text-center">
              Fix the highlighted lines to enable submit.
            </p>
          )}
        </section>
      </main>

      {/* Mobile sticky summary */}
      {rows.length > 0 && (
        <motion.div
          initial={{ y: 40 }}
          animate={{ y: 0 }}
          className="lg:hidden fixed inset-x-0 z-40 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 bottom-[calc(64px+env(safe-area-inset-bottom))]"
        >
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Grand total</p>
            <p className="text-base font-black text-slate-900">
              {formatPrice(grandTotal)} <span className="text-[10px] font-medium text-slate-400">· {totalUnits.toLocaleString()} units</span>
            </p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !allValid}
            className="min-h-11 px-5 font-bold rounded-xl text-xs"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1.5" />}
            Add to cart
          </Button>
        </motion.div>
      )}
    </div>
  )
}

export default BulkOrderFormPage
