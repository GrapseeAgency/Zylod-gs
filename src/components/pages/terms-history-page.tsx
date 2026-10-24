'use client'

/**
 * Terms Version History (Task 175-c) — honest empty state.
 *
 * The previous page fabricated v2.4 / v2.0 / v1.2 / v1.0 terms versions with
 * invented amendment descriptions ("Integrated Live Factory Shopping
 * broadcasting rules", "Clarified payment verification steps", "Added
 * mandatory e-TIN and municipal Trade License verification requirements",
 * "Initial platform terms of service launch"). No terms-history rail exists
 * — none of those versions or amendment descriptions are real.
 *
 * Rebuilt as an honest empty state matching the update-changelog / version-
 * history pattern: "No version history published yet — we do not publish
 * invented amendment entries." The fabricated v2.4 / v2.0 / v1.2 / v1.0
 * entries are gone.
 */
import { ArrowLeft, History, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function TermsHistoryPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile header (hidden on desktop where the AppShell Header is the chrome) */}
      <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button
          onClick={goBack}
          aria-label="Go back"
          className="p-1.5 min-h-11 min-w-11 flex items-center justify-center rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <div className="min-w-0">
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Terms Version History</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">Historical Amendments & Audit Logs</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-4 py-5 md:py-12 space-y-6 pb-24">
        <div className="hidden md:block border-b border-gray-100 dark:border-gray-800 pb-4">
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Terms Version History
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real historical amendments only — published as versions actually ship
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-slate-950 p-8 text-center space-y-3">
          <History className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-bold text-foreground">No version history published yet</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            When Zylod publishes an actual amendment to the Terms of Service, it will be listed here with its real
            version number, effective date, and the actual change summary. We do not publish invented amendment entries.
          </p>
        </div>

        <Button
          onClick={() => navigate('terms-of-service')}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold py-3"
        >
          Back to Active Terms
        </Button>
      </div>
    </div>
  )
}

export default TermsHistoryPage
