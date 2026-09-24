'use client'

import { ArrowLeft, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

// HONESTY NOTE: the previous changelog (v2.1.0–v2.4.0 with "SafePay multi-tier
// escrow", "Live Factory streaming", future 2026 dates) was entirely fabricated —
// no such releases exist. Replaced with an honest empty state until a real
// release ships.
export function VersionHistoryPage() {
  const { navigate } = useNavigationStore()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-update')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Updates
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Version History & Release Archive</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Real release notes only — published as versions actually ship</p>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 p-8 text-center space-y-2">
        <History className="h-8 w-8 mx-auto text-gray-400" />
        <h2 className="text-sm font-bold text-foreground">No releases published yet</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          When Zylod ships a real update, it will be listed here with its actual version number, date, and change notes. We do not publish invented changelog entries.
        </p>
      </div>
    </div>
  )
}
export default VersionHistoryPage
