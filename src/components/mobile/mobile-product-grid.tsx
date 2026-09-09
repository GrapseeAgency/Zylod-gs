'use client'

import { ProductCardSkeletonCompact } from '@/components/shared/loading-skeletons'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useProductStore, type Product } from '@/store/product-store'
import { MobileProductCard } from './mobile-product-card'
import { motion } from 'framer-motion'
import { ArrowUpDown, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Slider } from '@/components/ui/slider'

const PRODUCTS_PER_PAGE = 10

const SORT_OPTIONS = [
  { id: 'popularity', label: 'Most Popular' },
  { id: 'price-low', label: 'Price: Low to High' },
  { id: 'price-high', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest' },
  { id: 'rating', label: 'Top Rated' },
]



export function MobileProductGrid() {
  const { navigate } = useNavigationStore()
  const { products, filters, setFilters, sorting, setSorting, isInitialized, isLoading } = useProductStore()
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isFetching, setIsFetching] = useState(false)

  /* ─── Filter/Sort drawer state ─── */
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false)
  const [localPriceRange, setLocalPriceRange] = useState<[number, number]>(filters.priceRange)
  const [localMoq, setLocalMoq] = useState<number | null>(filters.moq)

  /* ─── Filter products based on current filters ─── */
  const filteredProducts = useMemo(() => {
    let result = [...products]

    // Category filter
    if (filters.category) {
      result = result.filter(p => {
        // Map navigation category IDs to product categoryIds
        const categoryMap: Record<string, string> = {
          'textiles-fabrics': 'cat-1',
          'agriculture-food': 'cat-2',
          'electronics': 'cat-3',
          'construction': 'cat-4',
          'packaging': 'cat-5',
          'home-garden': 'cat-6',
          'gifts-crafts': 'cat-7',
          'beauty-personal-care': 'cat-8',
          'promotional-items': 'cat-9',
        }
        const catId = categoryMap[filters.category!]
        return catId ? p.categoryId === catId : true
      })
    }

    // Price range filter
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 10000) {
      result = result.filter(p => p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1])
    }

    // MOQ filter
    if (filters.moq) {
      result = result.filter(p => p.moq <= filters.moq!)
    }

    // Search query filter
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
      )
    }

    // Sort
    switch (sorting) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price)
        break
      case 'price-high':
        result.sort((a, b) => b.price - a.price)
        break
      case 'popularity':
        result.sort((a, b) => b.soldCount - a.soldCount)
        break
      case 'newest':
        result.sort((a, b) => b.id.localeCompare(a.id))
        break
      case 'rating':
        result.sort((a, b) => b.rating - a.rating)
        break
    }

    return result
  }, [products, filters, sorting])

  const displayProducts = filteredProducts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredProducts.length

  // Reset visible count when filters change (use refs to avoid setState in effect)
  const [lastCategory, setLastCategory] = useState(filters.category)
  const [lastSearch, setLastSearch] = useState(filters.searchQuery)
  const [lastSorting, setLastSorting] = useState(sorting)

  if (filters.category !== lastCategory || filters.searchQuery !== lastSearch || sorting !== lastSorting) {
    setLastCategory(filters.category)
    setLastSearch(filters.searchQuery)
    setLastSorting(sorting)
    setVisibleCount(PRODUCTS_PER_PAGE)
    setIsFetching(false)
  }

  // Wait for store to be initialized from API
  useEffect(() => {
    if (isInitialized && !isLoading) {
      setIsInitialLoading(false)
    }
  }, [isInitialized, isLoading])

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isFetching) return
    setIsFetching(true)
    setIsLoadingMore(true)
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + PRODUCTS_PER_PAGE, filteredProducts.length))
      setIsLoadingMore(false)
      setIsFetching(false)
    }, 400)
  }, [isLoadingMore, hasMore, isFetching, filteredProducts.length])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore()
        }
      },
      { rootMargin: '400px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  /* ─── Apply filters ─── */
  const applyFilters = () => {
    setFilters({
      priceRange: localPriceRange,
      moq: localMoq,
    })
    setFilterDrawerOpen(false)
  }

  /* ─── Reset filters ─── */
  const resetFilters = () => {
    setLocalPriceRange([0, 10000])
    setLocalMoq(null)
    setFilters({
      priceRange: [0, 10000],
      moq: null,
      category: null,
      searchQuery: '',
      supplier: null,
      location: null,
    })
    setFilterDrawerOpen(false)
  }

  if (isInitialLoading) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 skeleton-shimmer rounded w-40" />
          <div className="h-4 skeleton-shimmer rounded w-12" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeletonCompact key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="mt-4">
      {/* Section header - minimal, just sort/filter */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="flex items-center justify-between mb-3"
      >
        <h4 className="font-semibold text-sm text-foreground">
          {filters.category
            ? CATEGORY_PILLS.find(c => c.id === filters.category)?.name || 'Products'
            : 'Recommended'
          }
        </h4>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSortDrawerOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-[11px] font-medium text-muted-foreground active:scale-95 transition-transform"
          >
            <ArrowUpDown className="w-3 h-3" />
            Sort
          </button>
          <button
            onClick={() => setFilterDrawerOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-[11px] font-medium text-muted-foreground active:scale-95 transition-transform"
          >
            <SlidersHorizontal className="w-3 h-3" />
            Filter
          </button>
        </div>
      </motion.div>

      {/* Product grid - 2 columns */}
      {displayProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {displayProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
            >
              <MobileProductCard product={product} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No products found</p>
          <button
            onClick={resetFilters}
            className="mt-2 text-primary text-xs font-semibold"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Skeleton loading cards */}
      {isLoadingMore && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeletonCompact key={i} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {/* End of list / loading indicator */}
      {!hasMore && filteredProducts.length > 0 && (
        <div className="mt-8 mb-4 flex flex-col items-center gap-2">
          <div className="w-12 h-1 bg-muted rounded-full" />
          <p className="text-muted-foreground text-xs font-medium">
            You&apos;ve seen all verified products
          </p>
        </div>
      )}

      {hasMore && !isLoadingMore && (
        <div className="mt-8 mb-4 flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary/20 animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-primary/20 animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
          <p className="text-muted-foreground text-xs font-medium">
            Loading more verified suppliers...
          </p>
        </div>
      )}

      {/* Sort Drawer */}
      <Drawer open={sortDrawerOpen} onOpenChange={setSortDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-primary" />
              Sort By
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <div className="space-y-0.5">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setSorting(option.id as any)
                    setSortDrawerOpen(false)
                  }}
                  className={`flex items-center justify-between w-full py-3 px-3 rounded-lg transition-colors text-left ${
                    sorting === option.id
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <span className="text-sm">{option.label}</span>
                  {sorting === option.id && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Filter Drawer */}
      <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              Filters
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-5">
            {/* Price Range */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Price Range</p>
              <Slider
                value={localPriceRange}
                onValueChange={(value) => setLocalPriceRange(value as [number, number])}
                min={0}
                max={10000}
                step={50}
                className="w-full"
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>৳{localPriceRange[0]}</span>
                <span>৳{localPriceRange[1]}</span>
              </div>
            </div>

            {/* MOQ Filter */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Max MOQ</p>
              <div className="flex flex-wrap gap-2">
                {[50, 100, 200, 500, 1000, null].map((moq) => (
                  <button
                    key={moq ?? 'any'}
                    onClick={() => setLocalMoq(moq)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      localMoq === moq
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {moq ? `≤ ${moq}` : 'Any'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DrawerFooter className="flex-row gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={resetFilters}
            >
              Reset
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground"
              onClick={applyFilters}
            >
              Apply
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  )
}

/* Category pills data for display (same as mobile-category-pills) */
const CATEGORY_PILLS = [
  { id: 'all', name: 'All Products' },
  { id: 'textiles-fabrics', name: 'Textiles' },
  { id: 'agriculture-food', name: 'Agriculture' },
  { id: 'electronics', name: 'Electronics' },
  { id: 'construction', name: 'Construction' },
  { id: 'packaging', name: 'Packaging' },
  { id: 'home-garden', name: 'Home & Garden' },
  { id: 'gifts-crafts', name: 'Handicrafts' },
  { id: 'beauty-personal-care', name: 'Beauty' },
  { id: 'promotional-items', name: 'Promo Items' },
]
