'use client'

import { MousePointerClick, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

// HONESTY NOTE: this page previously displayed fabricated deep-link telemetry
// (invented campaign rows with fake click/conversion counts, an "Escrow
// Conversions" stat, "SafePay Escrow Launch Promo"). No link-analytics backend
// exists yet, so the page now shows an honest empty state instead of fake data.
export function LinkAnalyticsPage() {
  const { navigate } = useNavigationStore()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('deep-link-handler')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Deep Link Engine
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Deep Link Click Telemetry & Attribution</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Click attribution will be published here once tracking data exists</p>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 p-8 text-center space-y-2">
        <MousePointerClick className="h-8 w-8 mx-auto text-gray-400" />
        <h2 className="text-sm font-bold text-foreground">No link telemetry recorded yet</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          When real deep-link campaigns run, their click and conversion counts will be listed here straight from the tracking data. Zylod does not display invented analytics figures.
        </p>
      </div>
    </div>
  )
}
export default LinkAnalyticsPage
