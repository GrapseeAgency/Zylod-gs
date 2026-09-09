import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

function calculatePrice(item: CartItemData, quantity: number): number {
  let applicablePrice = item.unitPrice
  
  if (item.priceTiers && item.priceTiers.length > 0) {
    for (const tier of item.priceTiers) {
      if (quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)) {
        applicablePrice = tier.pricePerUnit
        break
      }
    }
  }
  
  return applicablePrice * quantity
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isSynced: false,

      addItem: (item) => {
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
                  productImage: item.product?.images?.[0]?.url || item.product?.thumbnailUrl || null,
                  variantId: item.variantId,
                  variantName: item.variant?.variantName || null,
                  variantValue: item.variant?.variantValue || null,
                  quantity: item.quantity,
                  unitPrice: item.product?.basePrice || 0,
                  totalPrice: item.quantity * (item.product?.basePrice || 0),
                  moq: item.product?.moq || 1,
                  maxOrderQty: null,
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
              
              if (newFromApi.length > 0) {
                set({ items: [...get().items, ...newFromApi], isSynced: true })
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
