'use client'

import React, { useState } from 'react'
import { Clock, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function OfflineSyncQueuePage() {
  const { navigate } = useNavigationStore()
  const [syncing, setSyncing] = useState(false)
  const [cleared, setCleared] = useState(false)

  const items = [
    { id: '1', action: 'SAVE_WISHLIST', target: 'Product #clx8919 (Cotton Jersey Fabric)', time: '10 mins ago', status: 'Queued (Awaiting Network)' },
    { id: '2', action: 'DRAFT_RFQ', target: 'Supplier #sup201 (Ananta Garments MOQ 500)', time: '25 mins ago', status: 'Queued (Awaiting Network)' },
  ]

  const handleSyncAll = () => {
    setSyncing(true)
    setTimeout(() => {
      setSyncing(false)
      setCleared(true)
    }, 1500)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:px-6 md:space-y-8 lg:max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('offline-mode')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Offline Engine
      </Button>

      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Offline Mutation Sync Queue</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Actions performed while disconnected waiting for network reconnection</p>
        </div>
        <Button
          size="sm"
          onClick={handleSyncAll}
          disabled={syncing || cleared}
          className="bg-primary text-primary-foreground text-xs font-bold gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Reconciling...' : 'Reconcile Queue'}
        </Button>
      </div>

      {cleared ? (
        <Card className="rounded-2xl border p-6 text-center space-y-2 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
          <h3 className="font-bold text-sm text-foreground">Sync Queue is Clear</h3>
          <p className="text-xs text-muted-foreground">All pending mutations and offline RFQs have been processed by server.</p>
        </Card>
      ) : (
        <>
          <div className="hidden md:block rounded-2xl border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50/50 text-left">
                  <th className="px-4 py-3 font-semibold text-foreground">Action</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Target</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Queued</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-red-50/30">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">{i.action}</Badge>
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">{i.target}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.time}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                        {i.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((i) => (
              <Card key={i.id} className="rounded-2xl border shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">{i.action}</Badge>
                      <span className="font-bold text-xs text-foreground">{i.target}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{i.time}</p>
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                    {i.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
export default OfflineSyncQueuePage
