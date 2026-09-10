'use client'

import { useState, useRef, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useProductStore } from '@/store/product-store'
import { motion } from 'framer-motion'
import { ChevronRight, X, LayoutGrid } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface CategoryPill {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  count: number
}

interface Subcategory {
  name: string
  count: number
  slug: string
}

/* Visual palette — counts are live from /api/categories */
const COLORS = ['#E53935', '#388E3C', '#1976D2', '#F57C00', '#7B1FA2', '#00897B', '#C62828', '#AD1457', '#EF6C00', '#455A64', '#004D40', '#1565C0', '#FF8F00', '#6A1B9A', '#D81B60', '#2E7D32', '#5D4037', '#E65100', '#37474F', '#283593']
const ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  'textiles-fabrics': LayoutGrid,
  'agriculture-food': LayoutGrid,
  'electronics': LayoutGrid,
  'construction': LayoutGrid,
  'packaging': LayoutGrid,
  'home-garden': LayoutGrid,
  'gifts-crafts': LayoutGrid,
  'beauty-personal-care': LayoutGrid,
  'promotional-items': LayoutGrid,
  'automotive': LayoutGrid,
  'medical-supplies': LayoutGrid,
  'mobile-accessories': LayoutGrid,
  'led-lighting': LayoutGrid,
  'spices': LayoutGrid,
  'garments': LayoutGrid,
  'sports-fitness': LayoutGrid,
  'books-stationery': LayoutGrid,
  'toys': LayoutGrid,
  'jewelry': LayoutGrid,
  'furniture': LayoutGrid,
}

/* Map DB slug → navigation pageId */
const CATEGORY_PAGE_MAP: Record<string, string> = {
  'textiles-fabrics': 'textiles-fabrics',
  'agriculture-food': 'agriculture-food',
  'electronics': 'electronics',
  'construction': 'construction',
  'packaging': 'packaging',
  'home-garden': 'home-garden',
  'gifts-crafts': 'gifts-crafts',
  'beauty-personal-care': 'beauty-personal-care',
  'promotional-items': 'promotional-items',
  'automotive': 'automotive',
  'medical-supplies': 'medical-supplies',
  'mobile-accessories': 'mobile-accessories',
  'led-lighting': 'led-lighting',
  'spices': 'spices',
  'garments': 'garments',
  'sports-fitness': 'sports-fitness',
  'books-stationery': 'books-stationery',
  'toys': 'toys',
  'jewelry': 'jewelry',
  'furniture': 'furniture',
}

interface LiveCat {
  id: string
  name: string
  slug: string
  productCount: number
  children: { id: string; name: string; slug: string; productCount: number }[]
}

export function MobileCategoryPills() {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { navigate } = useNavigationStore()
  const { setFilters } = useProductStore()
  const [pills, setPills] = useState<CategoryPill[]>([])
  const [subcatMap, setSubcatMap] = useState<Record<string, Subcategory[]>>({})
  const [loading, setLoading] = useState(true)

  /* ─── Drawer state ─── */
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryPill | null>(null)

  /* ─── Long press detection ─── */
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isLongPress, setIsLongPress] = useState(false)

  /* ─── Load real categories + counts ─── */
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          const cats: LiveCat[] = json.data
          const built: CategoryPill[] = [
            { id: 'all', name: 'All', icon: LayoutGrid, color: '#E53935', count: 0 },
            ...cats.map((c, i) => ({
              id: c.slug,
              name: c.name,
              icon: ICONS[c.slug] || LayoutGrid,
              color: COLORS[i % COLORS.length],
              count: c.productCount || 0,
            })),
          ]
          setPills(built)
          const subMap: Record<string, Subcategory[]> = {}
          cats.forEach(c => {
            subMap[c.slug] = (c.children || []).map(ch => ({ name: ch.name, count: ch.productCount || 0, slug: ch.slug }))
          })
          setSubcatMap(subMap)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handlePillClick = (index: number, pill: CategoryPill) => {
    if (isLongPress) {
      setIsLongPress(false)
      return
    }

    setActiveIndex(index)
    if (pill.id === 'all') {
      setFilters({ category: null })
    } else {
      setFilters({ category: pill.id })
    }
  }

  const handlePillLongPress = (pill: CategoryPill) => {
    setIsLongPress(true)
    if (pill.id !== 'all' && subcatMap[pill.id] && subcatMap[pill.id].length > 0) {
      setSelectedCategory(pill)
      setDrawerOpen(true)
    }
  }

  const handleTouchStart = (pill: CategoryPill) => {
    longPressTimerRef.current = setTimeout(() => {
      handlePillLongPress(pill)
    }, 500)
  }

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleSubcategoryClick = (subcategory: Subcategory) => {
    setDrawerOpen(false)
    if (selectedCategory) {
      navigate(CATEGORY_PAGE_MAP[subcategory.slug] || CATEGORY_PAGE_MAP[selectedCategory.id] || selectedCategory.id as any)
    }
  }

  const handleViewAll = () => {
    setDrawerOpen(false)
    if (selectedCategory) {
      navigate(CATEGORY_PAGE_MAP[selectedCategory.id] || selectedCategory.id as any)
    }
  }

  const handleFindSuppliers = () => {
    setDrawerOpen(false)
    navigate('suppliers')
  }

  const subcategories = selectedCategory ? subcatMap[selectedCategory.id] || [] : []

  return (
    <section className="mt-3">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 -mx-4 py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loading ? (
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-7 w-20 rounded-full flex-none" />)}
          </div>
        ) : (
          pills.map((pill, i) => {
            const IconComp = pill.icon
            return (
              <button
                key={pill.id}
                onClick={() => handlePillClick(i, pill)}
                onTouchStart={() => handleTouchStart(pill)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className={`
                  flex-none flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95
                  ${activeIndex === i
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }
                `}
              >
                <IconComp className="w-3.5 h-3.5" />
                {pill.name}
              </button>
            )
          })
        )}
      </motion.div>

      {/* Category Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              {selectedCategory && (() => {
                const IconComp = selectedCategory.icon
                return <IconComp className="w-5 h-5" style={{ color: selectedCategory.color }} />
              })()}
              {selectedCategory?.name}
              {selectedCategory && selectedCategory.count > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {selectedCategory.count} products
                </span>
              )}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <div className="space-y-0.5">
              {subcategories.map((sub) => (
                <button
                  key={sub.name}
                  onClick={() => handleSubcategoryClick(sub)}
                  className="flex items-center justify-between w-full py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors active:bg-muted text-left"
                >
                  <span className="text-sm font-medium text-foreground">{sub.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{sub.count}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
          <DrawerFooter className="flex-row gap-2 pt-2">
            <Button
              className="flex-1 text-xs font-semibold bg-primary text-primary-foreground"
              onClick={handleViewAll}
            >
              View All {selectedCategory?.name}
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-xs font-medium"
              onClick={handleFindSuppliers}
            >
              Find Suppliers
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  )
}