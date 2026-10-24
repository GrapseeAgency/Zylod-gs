'use client'

/**
 * SHIPPING COURIER INTEGRATION — Task 176-c. The previous page rendered
 * uncontrolled `<input>` fields for API Key / API Secret / Store ID and a
 * "Connect" button with NO onClick handler — pure showcase. No courier
 * API-integration writer rail exists on Zylod (courier tracking numbers
 * are entered per-shipment via the supplier order-fulfillment flow; there
 * is no merchant-account-level Pathao/RedX/Paperfly OAuth or API-key
 * store). The page also showed a fabricated read-only webhook URL.
 *
 * This rewrite is an honest empty state. The real courier integration
 * path on Zylod is per-shipment: when a supplier fulfils an order, they
 * enter the courier name + tracking number on the order-detail page, and
 * the buyer sees the tracking events. Link to that surface as the honest
 * &quot;what you CAN do today&quot; path.
 */
import React from 'react'
import { ArrowLeft, Link2, Truck, AlertCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useNavigationStore } from '@/store/navigation-store'

export function ShippingCourierIntegrationPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={goBack} aria-label="Go back" className="p-1 -ml-1 text-gray-600 dark:text-gray-400">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">Courier Integration</h1>
      </header>

      <main className="p-4 md:p-6 space-y-5 max-w-3xl md:mx-auto md:pt-6 pb-24 md:pb-8">
        <div className="hidden md:block">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-2 text-xs font-semibold">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-black mt-2">Courier Integration</h1>
          <p className="text-xs text-muted-foreground mt-0.5">How courier handoff works on Zylod today</p>
        </div>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Link2 className="h-4 w-4" />
              </div>
              <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <p className="font-bold text-slate-900 dark:text-slate-100">Per-account API keys aren&apos;t wired yet</p>
                <p>
                  The previous version of this page asked for a Pathao/RedX/Paperfly API key, secret and store
                  ID, then showed a &quot;Connect&quot; button that did nothing on click — no merchant account
                  was linked, because no courier-OAuth or API-key writer rail exists on Zylod today. We no
                  longer pretend to save credentials that go nowhere.
                </p>
                <p>
                  Couriers are integrated per-shipment instead: when you fulfil an order, you enter the courier
                  name and tracking number on the order-detail page. The buyer sees the courier and tracking
                  ID on their order timeline. When per-account API-key integration ships, this page will
                  actually call a real writer and the connection status will persist.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => navigate('seller-order-management')}
          className="cursor-pointer rounded-2xl border shadow-sm hover:border-primary transition-colors"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Truck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Enter tracking per order</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Open your order queue, pick an order to fulfil, and enter the courier + tracking ID. The buyer
                sees it on their timeline instantly.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-4 flex items-start gap-3 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>
              Need per-account API integration for high-volume fulfillment? Message Zylod support — your
              request will be tracked and the integration prioritised against real seller demand.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default ShippingCourierIntegrationPage
