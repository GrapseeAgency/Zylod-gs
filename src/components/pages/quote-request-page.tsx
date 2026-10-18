'use client'

/**
 * Quote Request (RFQ) page — id: 'quote-request'.
 *
 * Wired to the REAL RFQ system:
 *   - POST /api/rfq  (src/app/api/rfq/route.ts)
 *     Body: { title*, description*, categorySlug?, productId?, quantity?, unit?,
 *             targetPrice?, deliveryCity?, deadline?, items?: [
 *               { productName*, specifications?, quantity*, unit?, targetPrice? } ] }
 *     201 → { success: true, data: rfq } (rfq.id is the real request id)
 *     401 → { error: 'Authentication required' }
 *     400 → { error: 'title and description are required' | productId problems }
 *   - product context: GET /api/products/[id]
 *   - product picker:  GET /api/products?search=&limit=  (public list/search)
 *
 * Task 55-b: an attached product's REAL id is now sent as `productId` — the
 * RFQ becomes linked to a live marketplace product, which is exactly what
 * lets an accepted quote later be converted into a real order (convert-order
 * route). Freeform RFQs (no product) stay fully supported — they honestly
 * cannot be converted later. When no product is attached the flow is byte-
 * identical to before.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { PRODUCT_UNITS, PRODUCT_UNIT_LABELS, type ProductUnit } from '@/lib/product-contract'
import {
  ArrowLeft, FileText, Loader2, Package, Plus, Search,
  AlertTriangle, LogIn, RotateCcw, Tag, X, CheckCircle2,
} from 'lucide-react'

/* ─── Real API shapes ─── */

interface PickerProduct {
  id: string
  name: string
  unit: string
  moq: number
  basePrice: number
  supplierName: string
  imageUrl: string | null
  categorySlug: string | null
  priceTiers: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
}

interface CategoryOption {
  id: string
  name: string
  slug: string
}

/** Unit values the rfqRequests.unit comment allows: pcs | dozen | kg | carton | box | set */
const RFQ_UNITS = PRODUCT_UNITS
const isRfqUnit = (u: string): u is ProductUnit => (RFQ_UNITS as readonly string[]).includes(u)

interface FormState {
  title: string
  description: string
  quantity: string
  unit: ProductUnit
  targetPrice: string
  deliveryCity: string
  deadline: string
  categorySlug: string
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  quantity: '',
  unit: 'pcs',
  targetPrice: '',
  deliveryCity: '',
  deadline: '',
  categorySlug: '',
}

interface FieldErrors {
  title?: string
  description?: string
  quantity?: string
  targetPrice?: string
  deadline?: string
  itemQuantity?: string
}

export function QuoteRequestPage() {
  const { goBack, navigate, pageParams } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  // product-detail-page navigates here with { productId: product?.id || '' }
  const productId = typeof pageParams?.productId === 'string' ? pageParams.productId : ''

  /* ─── Product context (from param or picker) ─── */
  const [product, setProduct] = useState<PickerProduct | null>(null)
  const [productLoading, setProductLoading] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)
  const [productStatus, setProductStatus] = useState<number | null>(null)
  const [productRetry, setProductRetry] = useState(0)

  /* ─── Picker state (only when navigated without a productId) ─── */
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerResults, setPickerResults] = useState<PickerProduct[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<number | null>(null)
  const [created, setCreated] = useState<{ id: string } | null>(null)

  const normalizePickerProduct = useCallback((raw: Record<string, unknown>): PickerProduct => {
    const supplier = raw.supplier as { companyName?: string } | undefined
    const category = raw.category as { slug?: string } | undefined
    const images = raw.images as { imageUrl?: string }[] | undefined
    const tiers = raw.priceTiers as { minQty: number; maxQty: number | null; pricePerUnit: number }[] | undefined
    return {
      id: (raw.id as string) ?? '',
      name: (raw.name as string) ?? '',
      unit: (raw.unit as string) ?? 'pcs',
      moq: (raw.moq as number) ?? 1,
      basePrice: (raw.basePrice as number) ?? 0,
      supplierName: supplier?.companyName ?? '',
      imageUrl: (raw.thumbnailUrl as string | null) ?? (images?.[0]?.imageUrl as string | undefined) ?? null,
      categorySlug: category?.slug ?? null,
      priceTiers: Array.isArray(tiers)
        ? tiers
            .map((t) => ({ minQty: t.minQty, maxQty: t.maxQty ?? null, pricePerUnit: t.pricePerUnit }))
            .sort((a, b) => a.minQty - b.minQty)
        : [],
    }
  }, [])

  // Load the product when the page was opened from a product (PDP → Request Quote).
  const loadProduct = useCallback(async (id: string) => {
    setProductLoading(true)
    setProductError(null)
    setProductStatus(null)
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}`)
      if (res.ok) {
        const data = await res.json()
        const p = normalizePickerProduct(data?.data ?? {})
        if (p.id) {
          setProduct(p)
          // Prefill from REAL product data — the buyer can edit everything.
          setForm((prev) => ({
            ...prev,
            title: prev.title || `Bulk quote: ${p.name}`,
            quantity: prev.quantity || String(p.moq),
            unit: isRfqUnit(p.unit) ? p.unit : 'pcs',
            categorySlug: prev.categorySlug || p.categorySlug || '',
          }))
        } else {
          setProductError('Product data was incomplete in the catalog response.')
        }
      } else {
        setProductError(
          res.status === 404
            ? 'This product could not be found — it may have been removed or is awaiting review.'
            : `Could not load the product (HTTP ${res.status}). Try again.`
        )
        setProductStatus(res.status)
      }
    } catch {
      setProductError('Could not reach the product service. Check your connection and try again.')
    } finally {
      setProductLoading(false)
    }
  }, [normalizePickerProduct])

  useEffect(() => {
    if (productId) {
      loadProduct(productId)
    }
  }, [productId, productRetry, loadProduct])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/categories')
        if (res.ok && mounted) {
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
        // Category select is optional — the form still works without it.
      }
    })()
    return () => { mounted = false }
  }, [])

  /* ─── Picker search ─── */
  const runPickerSearch = useCallback(async () => {
    setPickerLoading(true)
    setPickerError(null)
    try {
      const params = new URLSearchParams({ limit: '8', page: '1' })
      if (pickerQuery.trim()) params.set('search', pickerQuery.trim())
      const res = await fetch(`/api/products?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data.map(normalizePickerProduct) : []
        setPickerResults(items)
      } else {
        setPickerError(`Product search failed (HTTP ${res.status}). Try again.`)
        setPickerResults([])
      }
    } catch {
      setPickerError('Could not reach the product service. Check your connection and try again.')
      setPickerResults([])
    } finally {
      setPickerLoading(false)
    }
  }, [pickerQuery, normalizePickerProduct])

  // Open the picker with the first page of real products already loaded.
  const openPicker = useCallback(() => {
    setPickerOpen(true)
    runPickerSearch()
  }, [runPickerSearch])

  const attachProduct = useCallback((p: PickerProduct) => {
    setProduct(p)
    setPickerOpen(false)
    setProductError(null)
    setForm((prev) => ({
      ...prev,
      title: prev.title || `Bulk quote: ${p.name}`,
      quantity: prev.quantity || String(p.moq),
      unit: isRfqUnit(p.unit) ? p.unit : 'pcs',
      categorySlug: prev.categorySlug || p.categorySlug || '',
    }))
  }, [])

  const detachProduct = useCallback(() => {
    setProduct(null)
    setProductError(null)
  }, [])

  /* ─── Validation mirroring the REAL API rules ───
   * POST /api/rfq enforces exactly: title + description present.
   * Everything else is optional; quantities are Int, targetPrice is Float,
   * deadline must parse as a date. Mirror those types strictly. */
  const validate = useCallback((): FieldErrors => {
    const errors: FieldErrors = {}
    if (!form.title.trim()) errors.title = 'Title is required.'
    if (!form.description.trim()) errors.description = 'Describe what you need — suppliers quote from this.'
    if (form.quantity.trim()) {
      const q = Number(form.quantity)
      // Unit-bearing decimal: a 12.5 kg RFQ is perfectly valid.
      if (!Number.isFinite(q) || q <= 0) errors.quantity = 'Quantity must be a positive number.'
    }
    if (form.targetPrice.trim()) {
      const p = Number(form.targetPrice)
      if (!Number.isFinite(p) || p <= 0) errors.targetPrice = 'Target price must be a positive number.'
    }
    if (form.deadline) {
      const d = new Date(form.deadline)
      if (Number.isNaN(d.getTime())) errors.deadline = 'Deadline must be a valid date.'
    }
    return errors
  }, [form])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const setField = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitError(null)
    setSubmitStatus(null)

    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error('Check the highlighted fields')
      return
    }

    // Exact POST /api/rfq contract — nothing invented, nothing missing.
    const quantityNum = form.quantity.trim() ? Number(form.quantity) : null
    const targetPriceNum = form.targetPrice.trim() ? Number(form.targetPrice) : null
    const unitValue = isRfqUnit(form.unit) ? form.unit : 'pcs'

    const body: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
    }
    if (form.categorySlug) body.categorySlug = form.categorySlug
    if (quantityNum != null) body.quantity = quantityNum
    body.unit = unitValue
    if (targetPriceNum != null) body.targetPrice = targetPriceNum
    if (form.deliveryCity.trim()) body.deliveryCity = form.deliveryCity.trim()
    if (form.deadline) body.deadline = form.deadline
    if (product) {
      // Task 55-b: LINK the RFQ to the marketplace product — this is what makes
      // an accepted quote convertible into a real order later. The id is the
      // real catalog id (param or picker), never invented.
      body.productId = product.id
      // Product context also stays a real line item (existing behaviour kept).
      body.items = [
        {
          productName: product.name,
          quantity: quantityNum ?? product.moq,
          unit: unitValue,
          ...(targetPriceNum != null ? { targetPrice: targetPriceNum } : {}),
        },
      ]
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/rfq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => null)

      if (res.status === 201 && data?.success && data?.data?.id) {
        // Real success only — with the real RFQ id from the server.
        setCreated({ id: data.data.id })
        toast.success('Quote request submitted', { description: `Request ${data.data.id} is now visible to suppliers.` })
        return
      }

      if (res.status === 401) {
        setSubmitError(data?.error || 'Authentication required')
      } else if (res.status === 400) {
        setSubmitError(data?.error || 'The request was rejected as invalid.')
      } else {
        setSubmitError(data?.error || `The quote service returned HTTP ${res.status}.`)
      }
      setSubmitStatus(res.status)
    } catch {
      setSubmitError('Could not reach the quote service. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }, [submitting, validate, form, product, token])

  /* ─── Success state — real id, real navigation ─── */
  if (created) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center space-y-3"
        >
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
          <h1 className="text-lg font-black text-slate-900">Quote request submitted</h1>
          <p className="text-xs text-slate-500">
            Your RFQ was saved with the reference{' '}
            <span className="font-bold text-slate-800 break-all">{created.id}</span>. Suppliers can now respond with quotes — track them in your quote requests list.
          </p>
          <div className="space-y-2 pt-2">
            <Button className="w-full min-h-11 text-xs font-bold rounded-xl" onClick={() => navigate('rfq-list')}>
              View My Quote Requests
            </Button>
            <Button variant="outline" className="w-full min-h-11 text-xs font-bold rounded-xl border-slate-200" onClick={() => navigate('home')}>
              Back to Home
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:px-6">
        <div className="md:max-w-2xl md:mx-auto flex items-center gap-3">
          <button
            onClick={goBack}
            aria-label="Go back"
            className="h-11 w-11 flex items-center justify-center rounded-full hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <div>
            <h1 className="text-base md:text-lg font-black tracking-tight text-slate-900">Request a Bulk Quote</h1>
            <p className="text-[11px] text-slate-500">Tell suppliers what you need — they respond with tiered offers.</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-6">
        {/* ─── Product context ─── */}
        {productId || product ? (
          productLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex gap-3">
              <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ) : product ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex gap-3">
              <div className="w-14 h-14 rounded-xl bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 line-clamp-1">{product.name}</p>
                {product.supplierName ? (
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{product.supplierName}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-medium text-slate-600 bg-slate-100 rounded-md px-1.5 py-0.5">
                    {formatPrice(product.basePrice)}/{product.unit}
                  </span>
                  <span className="text-[10px] font-medium text-slate-600 bg-slate-100 rounded-md px-1.5 py-0.5">
                    MOQ {product.moq.toLocaleString()} {product.unit}
                  </span>
                  {product.priceTiers.length > 0 && product.basePrice > 0
                    ? (() => {
                        const best = product.priceTiers.reduce((b, t) => (t.pricePerUnit < b.pricePerUnit ? t : b))
                        const pct = Math.round(((product.basePrice - best.pricePerUnit) / product.basePrice) * 100)
                        return pct > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5">
                            <Tag className="h-2.5 w-2.5" />
                            Save {pct}% at {best.minQty.toLocaleString()}+ {product.unit}
                          </span>
                        ) : null
                      })()
                    : null}
                </div>
              </div>
              {!productId ? (
                <button
                  onClick={detachProduct}
                  aria-label="Remove attached product"
                  className="h-11 w-11 flex items-center justify-center text-slate-400 hover:text-primary shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 text-center space-y-2">
              <AlertTriangle className="h-8 w-8 mx-auto text-primary" />
              <p className="text-xs font-bold text-slate-800">{productError}</p>
              {productStatus ? <p className="text-[11px] text-slate-400">HTTP {productStatus} from /api/products</p> : null}
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button variant="outline" size="sm" className="min-h-11 text-xs font-semibold text-primary border-primary" onClick={() => setProductRetry((t) => t + 1)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
                <Button variant="outline" size="sm" className="min-h-11 text-xs font-semibold text-slate-600 border-slate-200" onClick={() => navigate('category-browser')}>
                  Browse Products
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <p className="text-xs font-bold text-slate-800">Link a marketplace product (optional)</p>
            </div>
            <p className="text-[11px] text-slate-500">
              Pick something from the catalog to quote against — a linked product lets you convert an
              accepted quote straight into a real order. Or skip it and describe what you need below.
            </p>
            {!pickerOpen ? (
              <Button variant="outline" className="w-full min-h-11 text-xs font-bold rounded-xl border-slate-200" onClick={openPicker}>
                <Search className="h-4 w-4 mr-1.5" /> Choose from catalog
              </Button>
            ) : (
              <div className="space-y-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    runPickerSearch()
                  }}
                  className="relative flex items-center"
                >
                  <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search products…"
                    aria-label="Search products to attach"
                    className="pl-9 pr-4 h-11 bg-slate-50 border-slate-200 rounded-xl text-xs font-medium"
                  />
                </form>
                {pickerLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex gap-2 items-center border border-slate-100 rounded-xl p-2">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <Skeleton className="h-3 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : pickerError ? (
                  <p className="text-[11px] font-bold text-primary">{pickerError}</p>
                ) : pickerResults.length === 0 ? (
                  <p className="text-[11px] text-slate-500 text-center py-3">
                    No approved products match this search.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {pickerResults.map((p) => (
                      <li key={p.id} className="py-2 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 line-clamp-1">{p.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {formatPrice(p.basePrice)}/{p.unit} · MOQ {p.moq.toLocaleString()}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="min-h-11 px-3 text-[11px] font-bold rounded-lg border-slate-200" onClick={() => attachProduct(p)}>
                          <Plus className="h-3.5 w-3.5 mr-0.5" /> Attach
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── RFQ form — mirrors POST /api/rfq exactly ─── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold text-slate-900">Request details</h2>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rfq-title" className="text-[11px] font-bold text-slate-600">Title *</Label>
            <Input
              id="rfq-title"
              value={form.title}
              onChange={(e) => setField({ title: e.target.value })}
              placeholder={product ? `Bulk quote: ${product.name}` : 'e.g. Weekly supply of packaging cartons'}
              className="h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium"
            />
            {fieldErrors.title ? <p className="text-[11px] font-bold text-primary">{fieldErrors.title}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rfq-description" className="text-[11px] font-bold text-slate-600">What do you need? *</Label>
            <textarea
              id="rfq-description"
              value={form.description}
              onChange={(e) => setField({ description: e.target.value })}
              rows={4}
              placeholder={
                product
                  ? 'Specs, grade, packaging, delivery city, payment terms…'
                  : 'Product type, specs, packaging, delivery city, payment terms…'
              }
              className="w-full min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {fieldErrors.description ? <p className="text-[11px] font-bold text-primary">{fieldErrors.description}</p> : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rfq-quantity" className="text-[11px] font-bold text-slate-600">
                Quantity {product ? `· MOQ ${product.moq.toLocaleString()} ${product.unit}` : ''}
              </Label>
              <Input
                id="rfq-quantity"
                type="number"
                inputMode="decimal"
                min={0.1}
                step="any"
                value={form.quantity}
                onChange={(e) => setField({ quantity: e.target.value })}
                placeholder={form.unit === 'kg' ? 'e.g., 12.5 kg' : 'How many units'}
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-bold"
              />
              {fieldErrors.quantity ? <p className="text-[11px] font-bold text-primary">{fieldErrors.quantity}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rfq-unit" className="text-[11px] font-bold text-slate-600">Unit</Label>
              <select
                id="rfq-unit"
                value={form.unit}
                onChange={(e) => setField({ unit: e.target.value as ProductUnit })}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {RFQ_UNITS.map((u) => (
                  <option key={u} value={u}>{PRODUCT_UNIT_LABELS[u]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rfq-target-price" className="text-[11px] font-bold text-slate-600">
                Target price (৳ per {form.unit}) — optional
              </Label>
              <Input
                id="rfq-target-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.targetPrice}
                onChange={(e) => setField({ targetPrice: e.target.value })}
                placeholder="What you're aiming to pay"
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-bold"
              />
              {fieldErrors.targetPrice ? <p className="text-[11px] font-bold text-primary">{fieldErrors.targetPrice}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rfq-deadline" className="text-[11px] font-bold text-slate-600">Deadline — optional</Label>
              <Input
                id="rfq-deadline"
                type="date"
                min={today}
                value={form.deadline}
                onChange={(e) => setField({ deadline: e.target.value })}
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium"
              />
              {fieldErrors.deadline ? <p className="text-[11px] font-bold text-primary">{fieldErrors.deadline}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rfq-city" className="text-[11px] font-bold text-slate-600">Delivery city — optional</Label>
              <Input
                id="rfq-city"
                value={form.deliveryCity}
                onChange={(e) => setField({ deliveryCity: e.target.value })}
                placeholder="e.g. Dhaka"
                className="h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rfq-category" className="text-[11px] font-bold text-slate-600">Category — optional</Label>
              <select
                id="rfq-category"
                value={form.categorySlug}
                onChange={(e) => setField({ categorySlug: e.target.value })}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id || c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Verbatim API error / honest states */}
          {submitError && (
            <div className="rounded-xl border border-primary/30 bg-red-50 p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                {submitStatus === 401 ? (
                  <LogIn className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                )}
                <p className="text-[11px] text-slate-700">
                  {submitStatus === 401
                    ? `Sign in to submit a quote request — the server answered: “${submitError}”.`
                    : submitError}
                  {submitStatus ? <span className="text-slate-400"> (HTTP {submitStatus})</span> : null}
                </p>
              </div>
              {submitStatus === 401 && (
                <Button type="button" className="w-full min-h-11 text-xs font-bold rounded-xl" onClick={() => navigate('login')}>
                  Sign In
                </Button>
              )}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full min-h-11 text-xs font-bold rounded-2xl shadow-md">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Submitting request…
              </>
            ) : (
              'Submit Quote Request'
            )}
          </Button>
          <p className="text-[10px] text-slate-400 text-center">
            Suppliers respond with per-unit quotes — you accept only if the price works for your shop.
          </p>
        </form>
      </main>
    </div>
  )
}

export default QuoteRequestPage
