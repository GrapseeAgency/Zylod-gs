'use client'

import React, { useState } from 'react'
import { Trash2, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useNavigationStore } from '@/store/navigation-store'

export function ClearStoragePage() {
  const { navigate } = useNavigationStore()
  const [clearImages, setClearImages] = useState(true)
  const [clearCatalogue, setClearCatalogue] = useState(false)
  const [clearInvoices, setClearInvoices] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleExecute = async () => {
    setLoading(true)
    try {
      await fetch('/api/app/storage-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheCategory: 'selective' }),
      })
      if (typeof window !== 'undefined' && (window as any).ZylodNativeBridge?.clearLocalAppCache) {
        (window as any).ZylodNativeBridge.clearLocalAppCache()
      }
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('storage-management')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Storage Manager
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Clear Local Storage Wizard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Select specific cache partitions to purge without logging you out</p>
      </div>

      {done && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Selected caches successfully deleted.
        </div>
      )}

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Selective Data Purge
          </CardTitle>
          <CardDescription className="text-xs">Your account credentials and active orders will remain completely intact</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border">
              <Checkbox id="img" checked={clearImages} onCheckedChange={(v: boolean) => setClearImages(v)} className="mt-0.5" />
              <div>
                <label htmlFor="img" className="text-sm font-bold text-foreground cursor-pointer">Cached Wholesale Images (45.0 MB)</label>
                <p className="text-xs text-muted-foreground">Product swatches, thumbnails, and mill logos</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border">
              <Checkbox id="cat" checked={clearCatalogue} onCheckedChange={(v: boolean) => setClearCatalogue(v)} className="mt-0.5" />
              <div>
                <label htmlFor="cat" className="text-sm font-bold text-foreground cursor-pointer">Offline Catalogue SQLite Cache (3.4 MB)</label>
                <p className="text-xs text-muted-foreground">Will re-download on next sync when connected</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border">
              <Checkbox id="inv" checked={clearInvoices} onCheckedChange={(v: boolean) => setClearInvoices(v)} className="mt-0.5" />
              <div>
                <label htmlFor="inv" className="text-sm font-bold text-foreground cursor-pointer">Temporary PDF Invoices (1.8 MB)</label>
                <p className="text-xs text-muted-foreground">Cached receipt documents & courier waybills</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <Button
              variant="destructive"
              onClick={handleExecute}
              disabled={loading || (!clearImages && !clearCatalogue && !clearInvoices)}
              className="text-xs font-bold gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Purging Data...' : 'Purge Selected Storage'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default ClearStoragePage
