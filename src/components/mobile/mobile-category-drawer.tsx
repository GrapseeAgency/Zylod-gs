'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { ChevronRight, X, Package } from 'lucide-react'

/* ─── Category Page Map (same as desktop category-sidebar) ─── */
const CATEGORY_PAGE_MAP: Record<string, string> = {
  'cat-1': 'textiles-fabrics',
  'cat-2': 'agriculture-food',
  'cat-3': 'electronics',
  'cat-4': 'construction',
  'cat-5': 'packaging',
  'cat-6': 'home-garden',
  'cat-7': 'gifts-crafts',
  'cat-8': 'beauty-personal-care',
  'cat-9': 'promotional-items',
  'cat-10': 'automotive',
  'cat-11': 'medical-supplies',
  'cat-12': 'mobile-accessories',
  'cat-13': 'led-lighting',
  'cat-14': 'spices',
  'cat-15': 'garments',
  'cat-16': 'sports-fitness',
  'cat-17': 'books-stationery',
  'cat-18': 'toys',
  'cat-19': 'jewelry',
  'cat-20': 'furniture',
}

/* ─── Props ─── */
interface CategoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: {
    id: string
    name: string
    subcategories: { name: string; count: number }[]
  } | null
}

export function MobileCategoryDrawer({ open, onOpenChange, category }: CategoryDrawerProps) {
  const { navigate } = useNavigationStore()

  if (!category) return null

  const categoryPageId = CATEGORY_PAGE_MAP[category.id] || category.id

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <DrawerTitle className="text-sm font-bold text-foreground">
              {category.name}
            </DrawerTitle>
          </div>
          <DrawerClose asChild>
            <button
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Close category drawer"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </DrawerClose>
        </DrawerHeader>

        {/* Subcategory List */}
        <div className="max-h-96 overflow-y-auto px-4 py-2">
          <AnimatePresence>
            {category.subcategories.map((sub, index) => (
              <motion.button
                key={sub.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="flex items-center justify-between w-full py-2.5 px-3 rounded-lg hover:bg-muted/50 active:scale-[0.98] transition-transform text-left"
                onClick={() => {
                  navigate(categoryPageId as any)
                  onOpenChange(false)
                }}
                aria-label={`Browse ${sub.name} - ${sub.count} products`}
              >
                <span className="text-xs font-medium text-foreground">{sub.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{sub.count}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <DrawerFooter className="border-t border-border/50 pt-3">
          <Button
            className="w-full text-xs font-semibold h-9"
            onClick={() => {
              navigate(categoryPageId as any)
              onOpenChange(false)
            }}
            aria-label={`View all ${category.name}`}
          >
            View All {category.name}
          </Button>
          <Button
            variant="outline"
            className="w-full text-xs font-semibold h-9 border-primary text-primary hover:bg-primary/5"
            onClick={() => {
              navigate('suppliers')
              onOpenChange(false)
            }}
            aria-label="Find suppliers"
          >
            Find Suppliers
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
