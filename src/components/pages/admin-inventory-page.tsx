'use client'

/**
 * Admin Inventory — cross-supplier stock audit (Task 51-b).
 *
 * Consumes GET /api/supplier/inventory?all=true (admin-only cross-supplier
 * mode of the REAL seller inventory endpoint): products with nested variants
 * + a real summary {totalSkus, totalVariantSkus, lowStockCount, outOfStockCount,
 * totalInventoryUnits}.
 *
 * Task 79: low-stock here honors each product's OWN seller-tuned
 * products.stockAlertThreshold (null = platform default ≤20) — the audit
 * shows the line each seller actually chose, not a guessed global constant.
 *
 * OVERSIGHT, NOT CONTROL: admins already have trusted API access if a stock
 * edit is ever truly needed (the PATCH accepts admin actors and audit-logs
 * it) — this page deliberately ships WITHOUT edit controls so the audit view
 * cannot be mistaken for the seller's operational console. Stock management
 * stays seller-side in inventory-management.
 *
 * SUPPLIER ATTRIBUTION: the ?all=true payload carries supplierId +
 * companyName + verificationStatus on every row, so the audit groups and
 * filters per supplier with real counts.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ShieldCheck, RefreshCw, AlertTriangle, Search, Boxes, Package, Layers,
  ChevronDown, ChevronUp, CheckCircle2, PackageX, Warehouse,
} from 'lucide-react'

// ── Real API types (GET /api/supplier/inventory?all=true) ──────────────
interface ApiVariant {
  id: string
  variantName: string
  variantValue: string
  sku: string | null
  stockQuantity: number
  priceOverride: number | null
}

interface ApiInventoryProduct {
  id: string
  name: string
  sku: string | null
  unit: string
  stockQuantity: number
  moq: number
  thumbnailUrl: string | null
  isActive: boolean
  isApproved: boolean
  updatedAt: string
  stockAlertThreshold: number | null
  category: { name: string } | null
  supplier: { id: string; companyName: string; verificationStatus: string } | null
  variants: ApiVariant[]
}

interface ApiSummary {
  totalSkus: number
  totalVariantSkus: number
  lowStockCount: number
  outOfStockCount: number
  totalInventoryUnits: number
}

/** Platform default for products whose seller never tuned their alert line. */
const LOW_STOCK_FALLBACK = 20

/** The low-stock line a product is actually judged against. */
function alertLineFor(p: Pick<ApiInventoryProduct, 'stockAlertThreshold'>): number {
  return p.stockAlertThreshold ?? LOW_STOCK_FALLBACK
}

function StockChip({ quantity, unit, alertLine }: { quantity: number; unit?: string; alertLine?: number }) {
  const line = alertLine ?? LOW_STOCK_FALLBACK
  if (quantity <= 0) {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 dark:bg-red-950 dark:text-red-400 dark:border-red-900">
        Out of stock
      </span>
    )
  }
  if (quantity <= line) {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900">
        Low · {quantity} {unit}
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900">
      In stock · {quantity} {unit}
    </span>
  )
}

type StockFilter = 'all' | 'in' | 'low' | 'out'

const STOCK_FILTERS: { key: StockFilter; label: string }[] = [
  { key: 'all', label: 'All stock states' },
  { key: 'out', label: 'Out of stock' },
  { key: 'low', label: 'Low (seller alert lines)' },
  { key: 'in', label: 'In stock' },
]

function matchesStockFilter(p: Pick<ApiInventoryProduct, 'stockQuantity' | 'stockAlertThreshold'>, filter: StockFilter): boolean {
  if (filter === 'out') return p.stockQuantity <= 0
  if (filter === 'low') return p.stockQuantity > 0 && p.stockQuantity <= alertLineFor(p)
  if (filter === 'in') return p.stockQuantity > alertLineFor(p)
  return true
}

export function AdminInventoryPage() {
  const { navigate } = useNavigationStore()

  const [items, setItems] = useState<ApiInventoryProduct[]>([])
  const [summary, setSummary] = useState<ApiSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [q, setQ] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const seqRef = useRef(0)

  const loadInventory = useCallback(async () => {
    const seq = ++seqRef.current
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    try {
      // ?all=true is admin-only cross-supplier mode on the real seller endpoint.
      const res = await fetch('/api/supplier/inventory?all=true', { credentials: 'include' })
      if (seq !== seqRef.current) return
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        setItems([])
        setSummary(null)
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load inventory (HTTP ${res.status})`)
        setItems([])
        setSummary(null)
        return
      }
      setItems(Array.isArray(json.data?.items) ? json.data.items : [])
      setSummary(json.data?.summary ?? null)
    } catch {
      if (seq !== seqRef.current) return
      setError('Network error while loading the inventory audit. Check your connection and retry.')
      setItems([])
      setSummary(null)
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => { loadInventory() }, [loadInventory])

  // Real client-side filtering over the real rows (search + stock state + supplier).
  const needle = q.trim().toLowerCase()
  const suppliers = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of items) {
      if (p.supplier?.id && !seen.has(p.supplier.id)) seen.set(p.supplier.id, p.supplier.companyName)
    }
    return Array.from(seen.entries()).map(([id, companyName]) => ({ id, companyName }))
  }, [items])
  const filtered = items.filter((p) => {
    if (needle && !p.name.toLowerCase().includes(needle)) return false
    if (supplierFilter !== 'all' && p.supplier?.id !== supplierFilter) return false
    return matchesStockFilter(p, stockFilter)
  })

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">The cross-supplier inventory audit is restricted to Zylod admins. Sign in with an admin account to audit platform stock.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 flex items-center justify-center">
            <Warehouse className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Inventory Audit</h1>
            <p className="text-[11px] text-slate-400">Read-only stock oversight across every supplier. Stock edits stay seller-side — sellers adjust quantities from their own console in real time.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadInventory()} className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Supplier filter (real attribution from the ?all=true payload) */}
      {suppliers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSupplierFilter('all')}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition ${supplierFilter === 'all' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            All suppliers ({items.length})
          </button>
          {suppliers.map((s) => (
            <button
              key={s.id}
              onClick={() => setSupplierFilter(s.id)}
              className={`h-9 px-4 rounded-xl text-xs font-bold transition ${supplierFilter === s.id ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              {s.companyName} ({items.filter((p) => p.supplier?.id === s.id).length})
            </button>
          ))}
        </div>
      )}

      {/* Summary stat cards (from the REAL summary object) */}
      {summary && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><Package className="h-3 w-3" /> Product SKUs</p>
            <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">{summary.totalSkus.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><Layers className="h-3 w-3" /> Variant SKUs</p>
            <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">{summary.totalVariantSkus.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Low stock</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{summary.lowStockCount.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-red-500 flex items-center gap-1"><PackageX className="h-3 w-3" /> Out of stock</p>
            <p className="text-xl font-black text-red-600 dark:text-red-400 mt-1">{summary.outOfStockCount.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><Boxes className="h-3 w-3" /> Total units</p>
            <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">{summary.totalInventoryUnits.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Search + stock-state filter */}
      <div className="flex flex-wrap items-center gap-2">
        {STOCK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStockFilter(f.key)}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition ${stockFilter === f.key ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            {f.label}
          </button>
        ))}
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value) }}
            placeholder="Search product name…"
            className="h-9 pl-9 rounded-xl text-xs"
          />
        </div>
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the inventory audit</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadInventory()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Package className="h-10 w-10 text-slate-300 mx-auto" />
          <h2 className="text-sm font-black">No inventory to audit</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">No seller has created any products yet, so there is no stock anywhere on the platform. Rows appear here as soon as suppliers launch listings.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Search className="h-10 w-10 text-slate-300 mx-auto" />
          <h2 className="text-sm font-black">Nothing matches the current filters</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {needle ? `No product name contains "${q}"` : 'No products'} in the selected stock state. Adjust the search or the stock-state filter.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
          <p className="text-[11px] text-slate-400">{filtered.length} of {items.length} SKUs shown (sorted lowest stock first)</p>
          {filtered.map((p) => {
            const isOpen = !!expanded[p.id]
            const variants = Array.isArray(p.variants) ? p.variants : []
            return (
              <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Row */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 min-w-[220px] flex-1">
                    <Package className="h-4 w-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {p.supplier?.companyName || 'Unknown supplier'} · {p.category?.name || 'uncategorized'}{p.sku ? ` · SKU ${p.sku}` : ''}
                      </p>
                    </div>
                  </div>
                  <StockChip quantity={p.stockQuantity} unit={p.unit} alertLine={alertLineFor(p)} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400"
                      title={p.stockAlertThreshold != null ? 'The seller tuned this product’s own low-stock alert line' : 'Falls back to the platform default alert line (≤20)'}
                    >
                      {p.stockAlertThreshold != null ? `Seller alert ≤${p.stockAlertThreshold}` : `Default alert ≤${LOW_STOCK_FALLBACK}`}
                    </span>
                    <span className={p.isApproved
                      ? 'text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-lg px-2 py-1 text-emerald-700 dark:text-emerald-400'
                      : 'text-[10px] font-bold bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg px-2 py-1 text-amber-700 dark:text-amber-400'}>
                      {p.isApproved ? 'Approved' : 'Pending review'}
                    </span>
                    {!p.isActive && (
                      <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400">
                        Hidden
                      </span>
                    )}
                    <span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400">
                      MOQ {p.moq.toLocaleString()}
                    </span>
                    {variants.length > 0 && (
                      <span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400">
                        {variants.length} variant{variants.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {variants.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                      className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700"
                    >
                      {isOpen ? <><ChevronUp className="h-3.5 w-3.5" /> Hide variants</> : <><ChevronDown className="h-3.5 w-3.5" /> Variants</>}
                    </Button>
                  )}
                </div>

                {/* Expandable variant rows (read-only stock truth) */}
                {isOpen && variants.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Variant stock (real productVariants rows)</p>
                    {variants.map((v) => (
                      <div key={v.id} className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2">
                        <div className="min-w-[180px] flex-1">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{v.variantName}: {v.variantValue}</p>
                          {v.sku && <p className="text-[10px] text-slate-400 font-mono">{v.sku}</p>}
                        </div>
                        {v.priceOverride !== null && (
                          <span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400">
                            price override set
                          </span>
                        )}
                        <StockChip quantity={v.stockQuantity} alertLine={alertLineFor(p)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Read-only footer */}
      {!loading && !error && items.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Read-only audit view — need to change stock? That is the seller&apos;s job from their inventory console; admins act through the audited inventory API when strictly necessary.
        </div>
      )}
    </div>
  )
}

export default AdminInventoryPage
