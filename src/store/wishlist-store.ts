import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WishlistItem {
  id: string
  name: string
  price: number
  originalPrice: number
  moq: number
  unit: string
  supplier: string
  location: string
  category: string
  customizable: boolean
}

interface WishlistState {
  items: WishlistItem[]
  addItem: (item: WishlistItem) => void
  removeItem: (productId: string) => void
  isInWishlist: (productId: string) => boolean
  toggleItem: (item: WishlistItem) => void
  getItemCount: () => number
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const { items } = get()
        if (!items.find((i) => i.id === item.id)) {
          set({ items: [...items, item] })
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.id !== productId) })
      },

      isInWishlist: (productId) => {
        return get().items.some((i) => i.id === productId)
      },

      toggleItem: (item) => {
        const { items } = get()
        if (items.find((i) => i.id === item.id)) {
          set({ items: items.filter((i) => i.id !== item.id) })
        } else {
          set({ items: [...items, item] })
        }
      },

      getItemCount: () => {
        return get().items.length
      },
    }),
    {
      name: 'zylod-wishlist',
    }
  )
)
