import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from '@/store/auth-store'

export interface CartItemData {
  id: string
  productId: string
  productName: string
  productSlug: string
  productImage: string | null
  variantId: string | null
  variantName: string | null
  variantValue: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  moq: number
  maxOrderQty: number | null
  supplierId: string
  supplierName: string
  supplierSlug: string
  unit: string
  priceTiers: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
  /** products.basePrice — lets qty changes re-resolve BELOW the first tier back to base (canonical rule step 3). Optional: lines added before this field existed fall back to unitPrice. */
  basePrice?: number | null
  /** productVariants.priceOverride for the selected variant — when set, the variant is priced individually and tiers do NOT apply (canonical rule step 1). */
  variantPriceOverride?: number | null
  /** products.bundleSize — Task 55-c bundle display depth ONLY (the price stays per bundle; pricing math is unchanged). Optional: legacy lines predate it. */
  bundleSize?: number | null
  /** Task 95: kg per ONE purchasable unit (a bundle when bundleSize > 1). Null = supplier never filed a weight — the shipment is honestly unquotable. */
  weightKg?: number | null
}

interface CartState {
  items: CartItemData[]
  isOpen: boolean
  isSynced: boolean
  
  addItem: (item: CartItemData) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  toggleCart: () => void
  setCartOpen: (open: boolean) => void
  getTotalBySupplier: (supplierId: string) => number
  getTotal: () => number
  getItemCount: () => number
  /** Sync cart with backend API when authenticated */
  syncWithApi: (buyerId: string) => Promise<void>
}

/** Tier/variant shape both the products API and CartItemData carry. */
export interface ClientPriceTier {
  minQty: number
  maxQty: number | null
  pricePerUnit: number
}

export interface ClientPriceInput {
  /** products.basePrice (optional for legacy lines). */
  basePrice?: number | null
  /** productVariants.priceOverride for the selected variant, if any. */
  variantPriceOverride?: number | null
  priceTiers: ClientPriceTier[]
  quantity: number
  /** Price the line was added with — last-resort fallback for legacy lines. */
  fallbackUnitPrice?: number
}

/**
 * ─── Canonical wholesale unit price, client-side mirror ───
 *
 * The single source of truth is `resolveUnitPrice` in src/lib/wholesale-pricing.ts
 * (campaign Task 50-b). GENUINE BLOCKER on importing it directly: it is async and
 * takes a Prisma.TransactionClient — it queries products/priceTiers in the DB —
 * while this helper runs in the browser. wholesale-pricing.ts is read+import-only
 * this round, so its pure decision core cannot be extracted there. The exact rule
 * is therefore replicated 1:1 here and shared by every buyer surface (cart store,
 * search results, bulk order form); if a pure helper ever lands in
 * wholesale-pricing.ts, DELETE this and import it instead.
 *
 * For a line with quantity `q`:
 *  1. variant with priceOverride != null → unitPrice = priceOverride.
 *     Variants are priced individually — price tiers DO NOT apply.
 *  2. else the tier where minQty ≤ q AND (maxQty == null OR q ≤ maxQty)
 *     → unitPrice = tier.pricePerUnit (tiers are ordered by minQty; the FIRST
 *     covering tier is taken, same as resolveUnitPrice's Array.find).
 *  3. else unitPrice = basePrice. Lines that predate the optional basePrice
 *     field fall back to the unitPrice they were added with (the resolved
 *     price at add time) — never a fabricated number.
 *
 * Server truth still wins: GET /api/cart re-prices every line via the real
 * resolveUnitPrice; this mirror only keeps LOCAL surfaces honest between syncs.
 */
export function resolveClientUnitPrice({
  basePrice,
  variantPriceOverride,
  priceTiers,
  quantity,
  fallbackUnitPrice = 0,
}: ClientPriceInput): number {
  // Rule 1 — variant priced individually, tiers do not apply.
  if (variantPriceOverride != null) {
    return variantPriceOverride
  }

  // Rule 2 — the tier where minQty ≤ q AND (maxQty == null OR q ≤ maxQty).
  if (priceTiers && priceTiers.length > 0) {
    for (const tier of priceTiers) {
      if (quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)) {
        return tier.pricePerUnit
      }
    }
  }

  // Rule 3 — no matching tier → base price (fallback: price at add time).
  return basePrice ?? fallbackUnitPrice
}

function calculatePrice(item: CartItemData, quantity: number): number {
  return (
    resolveClientUnitPrice({
      basePrice: item.basePrice,
      variantPriceOverride: item.variantPriceOverride,
      priceTiers: item.priceTiers,
      quantity,
      fallbackUnitPrice: item.unitPrice,
    }) * quantity
  )
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isSynced: false,

      addItem: (item) => {
        // t197 LAST-RESORT ACCOUNT WALL: the cart is account-scoped. Every
        // UI surface gates on authentication before calling addItem, but any
        // future call site that forgets the gate can no longer silently grow
        // a guest cart — the write is refused outright for logged-out users.
        if (!useAuthStore.getState().isAuthenticated) {
          return
        }
        const { items } = get()
        // Normalize the merge key — a stored null variantId vs an incoming
        // undefined one previously failed the === check, so the SAME product
        // was added as duplicate rows.
        const keyOf = (i: Pick<CartItemData, 'productId' | 'variantId'>) =>
          `${i.productId}::${i.variantId ?? null}`
        const existingIndex = items.findIndex(
          (i) => keyOf(i) === keyOf(item)
        )
        
        if (existingIndex >= 0) {
          const newQuantity = Math.max(items[existingIndex].quantity + item.quantity, item.moq)
          const newPrice = calculatePrice(item, newQuantity)
          const updatedItems = [...items]
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: newQuantity,
            totalPrice: newPrice,
            unitPrice: newPrice / newQuantity,
          }
          set({ items: updatedItems })
        } else {
          const adjustedQuantity = Math.max(item.quantity, item.moq)
          const adjustedPrice = calculatePrice(item, adjustedQuantity)
          set({
            items: [...items, {
              ...item,
              quantity: adjustedQuantity,
              totalPrice: adjustedPrice,
              unitPrice: adjustedPrice / adjustedQuantity,
            }],
          })
        }

        // Try to sync with API in the background
        (get() as CartStoreWithSync).syncWithApiBackground?.(item, 'add')
      },

      removeItem: (itemId) => {
        set({ items: get().items.filter((i) => i.id !== itemId) })
      },

      updateQuantity: (itemId, quantity) => {
        const { items } = get()
        const itemIndex = items.findIndex((i) => i.id === itemId)
        if (itemIndex < 0) return
        
        const item = items[itemIndex]
        const newPrice = calculatePrice(item, quantity)
        const updatedItems = [...items]
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          quantity,
          totalPrice: newPrice,
          unitPrice: newPrice / quantity,
        }
        set({ items: updatedItems })
      },

      clearCart: () => {
        set({ items: [] })
      },

      toggleCart: () => {
        set({ isOpen: !get().isOpen })
      },

      setCartOpen: (open) => {
        set({ isOpen: open })
      },

      getTotalBySupplier: (supplierId) => {
        return get().items
          .filter((i) => i.supplierId === supplierId)
          .reduce((sum, i) => sum + i.totalPrice, 0)
      },

      getTotal: () => {
        return get().items.reduce((sum, i) => sum + i.totalPrice, 0)
      },

      getItemCount: () => {
        // Number of distinct products in the cart (NOT summed quantity —
        // MOQ-inflated quantities made one add-to-cart show as "99+").
        return get().items.length
      },

      syncWithApi: async (buyerId: string) => {
        try {
          const res = await fetch(`/api/cart?buyerId=${encodeURIComponent(buyerId)}`)
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.data) {
              // If the API cart has items, merge with local cart
              const apiItems = data.data.suppliers?.flatMap(
                (s: any) => s.items?.map((item: any) => ({
                  id: item.id,
                  productId: item.productId,
                  productName: item.product?.name || '',
                  productSlug: item.product?.slug || '',
                  // products API image rows carry `imageUrl` (not `url`) —
                  // reading `.url` here silently broke merged-item thumbnails.
                  productImage: item.product?.images?.[0]?.imageUrl || item.product?.thumbnailUrl || null,
                  variantId: item.variantId,
                  variantName: item.variant?.variantName || null,
                  variantValue: item.variant?.variantValue || null,
                  quantity: item.quantity,
                  // Server truth: the cart API resolves each line's price via
                  // the canonical pricing rule — never trust a client-side
                  // recomputation from basePrice.
                  unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : (item.product?.basePrice || 0),
                  totalPrice: typeof item.totalPrice === 'number' ? item.totalPrice : item.quantity * (item.product?.basePrice || 0),
                  moq: item.product?.moq || 1,
                  maxOrderQty: item.product?.maxOrderQty ?? null,
                  // Canonical-rule inputs for honest local re-pricing on qty change.
                  basePrice: typeof item.product?.basePrice === 'number' ? item.product.basePrice : null,
                  variantPriceOverride: typeof item.variant?.priceOverride === 'number' ? item.variant.priceOverride : null,
                  // Task 55-c: bundle display depth (null = plain single units).
                  bundleSize: typeof item.product?.bundleSize === 'number' ? item.product.bundleSize : null,
                  // Task 95: per-unit weight for the checkout quote rail.
                  weightKg: typeof item.product?.weightKg === 'number' ? item.product.weightKg : null,
                  supplierId: item.supplierId || s.supplierId,
                  supplierName: s.supplierName || '',
                  supplierSlug: '',
                  unit: item.product?.unit || 'piece',
                  priceTiers: item.product?.priceTiers?.map((t: any) => ({
                    minQty: t.minQty,
                    maxQty: t.maxQty,
                    pricePerUnit: t.pricePerUnit,
                  })) || [],
                })) || []
              ) as CartItemData[]

              // Merge: keep local items, add API items that aren't locally present
              const localIds = new Set(get().items.map(i => i.productId))
              const newFromApi = apiItems.filter((i: CartItemData) => !localIds.has(i.productId))

              // Task 95 heal: locally-built lines predate fields the API row
              // carries (weightKg, bundleSize, tiers…). Backfill what the
              // local line lacks from its API twin — checkout must quote on
              // real weights, never on a stale local shape.
              const apiByProduct = new Map(apiItems.map((i: CartItemData) => [`${i.productId}::${i.variantId ?? null}`, i] as const))
              const healed = get().items.map((it) => {
                const api = apiByProduct.get(`${it.productId}::${it.variantId ?? null}`)
                if (!api) return it
                const patched: CartItemData = { ...it }
                if (patched.weightKg == null && api.weightKg != null) patched.weightKg = api.weightKg
                if (patched.bundleSize == null && api.bundleSize != null) patched.bundleSize = api.bundleSize
                if (patched.basePrice == null && api.basePrice != null) patched.basePrice = api.basePrice
                if ((patched.priceTiers?.length ?? 0) === 0 && api.priceTiers.length > 0) patched.priceTiers = api.priceTiers
                return patched
              })
              const healedChanged = healed.some((it, idx) => it !== get().items[idx])

              if (newFromApi.length > 0 || healedChanged) {
                set({ items: [...healed, ...newFromApi], isSynced: true })
              } else {
                set({ isSynced: true })
              }
            }
          }
        } catch {
          // Silent fail — local cart still works
        }
      },
    }),
    {
      name: 'b2b-cart-storage',
      // Clean up any duplicate rows created by the old buggy merge key
      onRehydrateStorage: () => (state) => {
        if (!state || state.items.length < 2) return
        const seen = new Map<string, CartItemData>()
        let changed = false
        for (const it of state.items) {
          const k = `${it.productId}::${it.variantId ?? null}`
          const prev = seen.get(k)
          if (prev) {
            changed = true
            const qty = prev.quantity + it.quantity
            prev.quantity = qty
            prev.totalPrice = calculatePrice(prev, qty)
            prev.unitPrice = prev.totalPrice / qty
          } else {
            seen.set(k, { ...it })
          }
        }
        if (changed) {
          setTimeout(() => useCartStore.setState({ items: Array.from(seen.values()) }), 0)
        }
      },
    }
  )
)

// Add background sync method outside the store definition
// This is a helper that the store methods call
interface CartStoreWithSync extends CartState {
  syncWithApiBackground?: (item: CartItemData, action: 'add' | 'remove' | 'update') => void
}

// Extend the store with background sync
const originalStore = useCartStore as any

// Add syncWithApiBackground to the store
;(useCartStore as any).getState().syncWithApiBackground = async (item: CartItemData, action: 'add' | 'remove' | 'update') => {
  // Get the current auth token from localStorage
  try {
    const authStorage = JSON.parse(localStorage.getItem('b2b-auth-storage') || '{}')
    const userId = authStorage?.state?.user?.id
    if (!userId) return // Not authenticated — skip API sync

    if (action === 'add') {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: userId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          supplierId: item.supplierId,
        }),
      })
    }
  } catch {
    // Silent fail
  }
}
