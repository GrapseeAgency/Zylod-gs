'use client'

/**
 * Offline Orders (Task 175-c) — honest empty state.
 *
 * The previous page rendered fabricated orders ("ORD-98214 Beximco Textiles
 * ৳245,000", "ORD-97810 Square Fashion Yarns ৳180,000") with "View Cached PDF"
 * buttons that only fired `alert()`. None of those orders exist, and the web
 * client is ALWAYS-ONLINE (per the t172 worklog) — the offline cache is an
 * Android-app-only concern.
 *
 * Rebuilt as an honest empty state: "The web client is always online — offline
 * order caching is native to the Android app." No fabricated orders, no
 * alert()-theater PDF buttons.
 */
import { ArrowLeft, WifiOff, Smartphone, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function OfflineOrdersPage() {
  const { navigate } = useNavigationStore()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:px-6 md:space-y-8 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('offline-mode')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Offline Engine
      </Button>

      <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
        <h1 className="text-2xl font-black text-foreground">Offline Order Receipts & Waybills</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Locally stored delivery challans and tax invoices accessible without cellular connection
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-slate-950 p-8 text-center space-y-3">
        <WifiOff className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 dark:text-gray-400" />
        <h2 className="text-sm font-bold text-foreground">The web client is always online</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Offline order caching is native to the Android app — when a buyer or seller loses cellular signal, the
          Android app keeps a local Room-SQLite cache of order receipts and waybills so they can be re-printed or
          re-shown without a connection. The web client (the page you are looking at now) is always connected, so it
          fetches every order live from the server. There are no offline-cached orders to list here.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('orders')}
            className="text-xs font-semibold gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" /> View live orders
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('apk-download')}
            className="text-xs font-semibold gap-1.5"
          >
            <Smartphone className="h-3.5 w-3.5" /> Get the Android app
          </Button>
        </div>
      </div>
    </div>
  )
}
export default OfflineOrdersPage
