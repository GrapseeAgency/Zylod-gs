import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* ─── Store Types ─── */

export interface Product {
  id: string
  name: string
  slug: string
  price: number
  originalPrice: number
  moq: number
  stock: number
  category: string
  categoryId: string
  supplierId: string
  supplierName: string
  location: string
  description: string
  images: string[]
  rating: number
  soldCount: number
  isCustomizable: boolean
  verificationStatus: 'verified' | 'pending' | 'unverified'
  unit: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string
  count: number
  subcategories: string[]
}

export type SortOption = 'price-low' | 'price-high' | 'popularity' | 'newest' | 'rating'

export interface ProductFilters {
  category: string | null
  priceRange: [number, number]
  moq: number | null
  supplier: string | null
  location: string | null
  searchQuery: string
}

/* ─── API Response Types ─── */

interface ApiProduct {
  id: string
  name: string
  slug: string
  basePrice: number
  moq: number
  stock: number
  brand: string | null
  unit: string
  description: string
  thumbnailUrl: string | null
  isActive: boolean
  isApproved: boolean
  isCustomizable: boolean
  soldCount: number
  ratingAvg: number
  reviewCount: number
  createdAt: string
  supplier: { id: string; companyName: string; ratingAvg: number } | null
  category: { id: string; name: string; slug: string } | null
  images: { id: string; url?: string; imageUrl?: string; sortOrder: number }[]
  priceTiers: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
  variants: unknown[]
}

interface ApiCategory {
  id: string
  name: string
  slug: string
  iconUrl: string | null
  sortOrder: number
  productCount: number
  supplierCount?: number
  children?: { id: string; name: string; slug: string; productCount: number }[]
}

interface ProductsApiResponse {
  success: boolean
  data: ApiProduct[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface CategoriesApiResponse {
  success: boolean
  data: ApiCategory[]
}

/* ─── Mapping Functions ─── */

function mapApiProduct(api: ApiProduct): Product {
  const bestTier = api.priceTiers?.[0]
  return {
    id: api.id,
    name: api.name,
    slug: api.slug,
    price: bestTier?.pricePerUnit ?? api.basePrice,
    originalPrice: api.basePrice,
    moq: api.moq,
    stock: api.stock,
    category: api.category?.name ?? 'Uncategorized',
    categoryId: api.category?.id ?? '',
    supplierId: api.supplier?.id ?? '',
    supplierName: api.supplier?.companyName ?? 'Unknown Supplier',
    location: 'Bangladesh',
    description: api.description,
    images: api.images?.length
      ? api.images.map((img) => img.imageUrl ?? img.url ?? '').filter((u) => u !== '')
      : api.thumbnailUrl
        ? [api.thumbnailUrl]
        : ['/images/placeholder.png'],
    rating: api.ratingAvg,
    soldCount: api.soldCount,
    isCustomizable: api.isCustomizable,
    verificationStatus: api.isApproved ? 'verified' : 'pending',
    unit: api.unit,
  }
}

function mapApiCategory(api: ApiCategory): Category {
  return {
    id: api.id,
    name: api.name,
    slug: api.slug,
    icon: api.iconUrl ?? 'Package',
    count: api.productCount ?? 0,
    subcategories: api.children?.map((c) => c.name) ?? [],
  }
}

/* ─── Sort Mapping (Store → API) ─── */

const SORT_MAP: Record<SortOption, { sortBy: string; sortOrder: string }> = {
  'price-low': { sortBy: 'basePrice', sortOrder: 'asc' },
  'price-high': { sortBy: 'basePrice', sortOrder: 'desc' },
  popularity: { sortBy: 'soldCount', sortOrder: 'desc' },
  newest: { sortBy: 'createdAt', sortOrder: 'desc' },
  rating: { sortBy: 'ratingAvg', sortOrder: 'desc' },
}

/* ─── State Interface ─── */

interface ProductState {
  products: Product[]
  categories: Category[]
  filters: ProductFilters
  sorting: SortOption
  pagination: {
    currentPage: number
    totalPages: number
    itemsPerPage: number
  }
  featuredProducts: Product[]
  trendingProducts: Product[]
  selectedProduct: Product | null

  /* Loading / Error / Init */
  isInitialized: boolean
  isLoading: boolean
  error: string | null

  /* Actions */
  setFilters: (filters: Partial<ProductFilters>) => void
  setSorting: (sorting: SortOption) => void
  setPage: (page: number) => void
  selectProduct: (product: Product | null) => void
  fetchProducts: () => Promise<void>
  fetchFeatured: () => Promise<void>
  fetchTrending: () => Promise<void>
  fetchCategories: () => Promise<void>
  initialize: () => Promise<void>
}

/* ─── Store ─── */

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      filters: {
        category: null,
        priceRange: [0, 50000],
        moq: null,
        supplier: null,
        location: null,
        searchQuery: '',
      },
      sorting: 'popularity',
      pagination: {
        currentPage: 1,
        totalPages: 1,
        itemsPerPage: 20,
      },
      featuredProducts: [],
      trendingProducts: [],
      selectedProduct: null,
      isInitialized: false,
      isLoading: false,
      error: null,

      /* ─── Setters ─── */

      setFilters: (filters) => {
        set((state) => ({ filters: { ...state.filters, ...filters } }))
      },

      setSorting: (sorting) => {
        set({ sorting })
      },

      setPage: (page) => {
        set((state) => ({
          pagination: { ...state.pagination, currentPage: page },
        }))
      },

      selectProduct: (product) => {
        set({ selectedProduct: product })
      },

      /* ─── Fetch Products (with API filters) ─── */

      fetchProducts: async () => {
        set({ isLoading: true, error: null })
        try {
          const { filters, sorting, pagination } = get()
          const { sortBy, sortOrder } = SORT_MAP[sorting]

          const params = new URLSearchParams()
          params.set('page', String(pagination.currentPage))
          params.set('limit', String(pagination.itemsPerPage))
          params.set('sortBy', sortBy)
          params.set('sortOrder', sortOrder)

          if (filters.category) params.set('category', filters.category)
          if (filters.searchQuery) params.set('search', filters.searchQuery)
          if (filters.priceRange[0] > 0) params.set('minPrice', String(filters.priceRange[0]))
          if (filters.priceRange[1] < 50000) params.set('maxPrice', String(filters.priceRange[1]))
          if (filters.supplier) params.set('supplier', filters.supplier)

          const res = await fetch(`/api/products?${params.toString()}`, {
            signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) throw new Error(`API ${res.status}`)

          const json: ProductsApiResponse = await res.json()
          if (!json.success) throw new Error('API returned unsuccessful response')

          const products = json.data.map(mapApiProduct)
          set({
            products,
            pagination: {
              ...pagination,
              totalPages: json.pagination.totalPages,
            },
            isLoading: false,
          })
        } catch (err) {
          console.error('fetchProducts failed:', err)
          set({
            products: [],
            isLoading: false,
            error: 'Failed to load products',
          })
        }
      },

      /* ─── Fetch Featured ─── */

      fetchFeatured: async () => {
        try {
          const res = await fetch('/api/products?sortBy=soldCount&sortOrder=desc&limit=10', {
            signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) throw new Error(`API ${res.status}`)

          const json: ProductsApiResponse = await res.json()
          if (!json.success) throw new Error('API returned unsuccessful response')

          set({ featuredProducts: json.data.map(mapApiProduct) })
        } catch (err) {
          console.error('fetchFeatured failed:', err)
          set({ featuredProducts: [] })
        }
      },

      /* ─── Fetch Trending ─── */

      fetchTrending: async () => {
        try {
          const res = await fetch('/api/products?sortBy=soldCount&sortOrder=desc&limit=10', {
            signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) throw new Error(`API ${res.status}`)

          const json: ProductsApiResponse = await res.json()
          if (!json.success) throw new Error('API returned unsuccessful response')

          set({ trendingProducts: json.data.map(mapApiProduct) })
        } catch (err) {
          console.error('fetchTrending failed:', err)
          set({ trendingProducts: [] })
        }
      },

      /* ─── Fetch Categories ─── */

      fetchCategories: async () => {
        try {
          const res = await fetch('/api/categories', {
            signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) throw new Error(`API ${res.status}`)

          const json: CategoriesApiResponse = await res.json()
          if (!json.success) throw new Error('API returned unsuccessful response')

          set({ categories: json.data.map(mapApiCategory) })
        } catch (err) {
          console.error('fetchCategories failed:', err)
          set({ categories: [] })
        }
      },

      /* ─── Initialize: auto-fetch on first load ─── */

      initialize: async () => {
        if (get().isInitialized) return
        set({ isLoading: true })

        try {
          // Featured & trending share the same query — one fetch fills both (4 calls → 2)
          const fetchTop = async () => {
            try {
              const res = await fetch('/api/products?sortBy=soldCount&sortOrder=desc&limit=10', {
                signal: AbortSignal.timeout(20000),
              })
              if (!res.ok) throw new Error(`API ${res.status}`)

              const json: ProductsApiResponse = await res.json()
              if (!json.success) throw new Error('API returned unsuccessful response')

              const mapped = json.data.map(mapApiProduct)
              set({ featuredProducts: mapped, trendingProducts: mapped })
            } catch (err) {
              console.error('fetchTop failed:', err)
              set({ featuredProducts: [], trendingProducts: [] })
            }
          }

          await Promise.allSettled([
            get().fetchProducts(),
            get().fetchCategories(),
            fetchTop(),
          ])
          set({ isInitialized: true })
        } catch (err) {
          console.error('initialize failed:', err)
          set({
            isInitialized: true, // still mark as initialized to prevent retry loops
            isLoading: false,
            error: 'Failed to load products',
            products: [],
            categories: [],
            featuredProducts: [],
            trendingProducts: [],
          })
        }
      },
    }),
    {
      name: 'b2b-product-storage',
      // Only persist UI state, not fetched data (which should be re-fetched)
      partialize: (state) => ({
        filters: state.filters,
        sorting: state.sorting,
        pagination: state.pagination,
      }),
    }
  )
)
