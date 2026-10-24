'use client'

/**
 * Update changelog (audit unit 29 — Task 174).
 *
 * HONESTY NOTE: the previous version of this page shipped a fabricated
 * "Official Release Notes — v2.4.0" with invented "Live Factory Shopping
 * Engine" and "Offline Wholesale Catalogue" features. No such release exists.
 * The twin page (version-history-page) was already fixed in t173 with the same
 * honesty note — this page was the missed sibling. Now delegates to the same
 * honest empty state: no invented changelog entries.
 */
import { ArrowLeft, FileCode2, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function UpdateChangelogPage() {
  const { navigate } = useNavigationStore()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-update')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Updates
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <FileCode2 className="h-6 w-6 text-primary" />
          Release Notes
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Real release notes only — published as versions actually ship</p>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-slate-950 p-8 text-center space-y-2">
        <History className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 dark:text-gray-400" />
        <h2 className="text-sm font-bold text-foreground">No releases published yet</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          When Zylod ships a real update, it will be listed here with its actual version number, date, and change notes. We do not publish invented changelog entries.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('version-history')} className="mt-3 text-xs gap-1.5">
          <History className="h-3.5 w-3.5" /> View version history
        </Button>
      </div>
    </div>
  )
}
export default UpdateChangelogPage
