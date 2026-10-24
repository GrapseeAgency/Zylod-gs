'use client'

/**
 * SELLER QUICK ACTIONS — Task 176-c. The previous page rendered two
 * non-clickable grey boxes ("Scan Barcode" / "Rapid Restock") that looked
 * like buttons but did nothing on tap — pure showcase. This rewrite turns
 * each tile into a real navigation entry to an existing page that does the
 * actual work: barcode-scanner (real barcode lookup via /api/search/barcode)
 * and inventory-restock (real intake form writing to /api/supplier/inventory).
 *
 * The page also hard-codes `bg-gray-900`/`text-white` (a dark theme that
 * ignores the user's theme preference) and a bare `<button>← Back</button>`
 * with no shadcn styling — replaced with theme-aware tokens and the
 * standard ghost Button used across the seller console.
 */
import React from 'react'
import { ArrowLeft, Barcode, PackagePlus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useNavigationStore } from '@/store/navigation-store'

const ACTIONS = [
  {
    id: 'barcode-scanner',
    title: 'Scan Barcode',
    desc: 'Look a product up by its EAN/UPC barcode and jump straight to its listing.',
    icon: Barcode,
  },
  {
    id: 'inventory-restock',
    title: 'Rapid Restock',
    desc: 'Open the intake form and record a new quantity against any SKU you sell.',
    icon: PackagePlus,
  },
] as const

export function SellerQuickActionsPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3 shadow-sm md:hidden">
        <button
          onClick={goBack}
          aria-label="Go back"
          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="font-bold text-base">Quick Actions</h1>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 py-6 md:py-8 md:px-6 space-y-5 pb-24 md:pb-8">
        <div className="hidden md:block">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-2 text-xs font-semibold">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-black mt-2">Quick Actions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Shortcuts to the seller tools you reach for most</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACTIONS.map(a => {
            const Icon = a.icon
            return (
              <Card
                key={a.id}
                onClick={() => navigate(a.id)}
                className="cursor-pointer rounded-2xl border shadow-sm hover:border-primary transition-colors"
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold">{a.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
export default SellerQuickActionsPage
