'use client'

import React from 'react'
import { FileText, ArrowLeft, Download, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function OfflineOrdersPage() {
  const { navigate } = useNavigationStore()

  const cachedOrders = [
    { orderId: 'ORD-98214', supplier: 'Beximco Textiles Ltd.', total: '৳245,000', date: 'Aug 14, 2026', status: 'In Transit', hasWaybill: true },
    { orderId: 'ORD-97810', supplier: 'Square Fashion Yarns', total: '৳180,000', date: 'Aug 10, 2026', status: 'Delivered', hasWaybill: true },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:px-6 md:space-y-8 lg:max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('offline-mode')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Offline Engine
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Offline Order Receipts & Waybills</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Locally stored delivery challans and tax invoices accessible without cellular connection</p>
      </div>

      <div className="hidden md:block rounded-2xl border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-red-50/50 text-left">
              <th className="px-4 py-3 font-semibold text-foreground">Order ID</th>
              <th className="px-4 py-3 font-semibold text-foreground">Supplier</th>
              <th className="px-4 py-3 font-semibold text-foreground">Date</th>
              <th className="px-4 py-3 font-semibold text-foreground">Total</th>
              <th className="px-4 py-3 font-semibold text-foreground">Status</th>
              <th className="px-4 py-3 font-semibold text-foreground text-right">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cachedOrders.map((o) => (
              <tr key={o.orderId} className="hover:bg-red-50/30">
                <td className="px-4 py-3 font-mono font-bold text-foreground">{o.orderId}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.supplier}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.date}</td>
                <td className="px-4 py-3 font-bold text-primary">{o.total}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => alert(`Opening cached PDF receipt for order ${o.orderId}`)}
                    className="text-xs font-semibold gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" /> View Cached PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {cachedOrders.map((o) => (
          <Card key={o.orderId} className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-foreground">{o.orderId}</span>
                  <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{o.supplier} • {o.date}</div>
                <div className="font-bold text-sm text-primary">{o.total}</div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => alert(`Opening cached PDF receipt for order ${o.orderId}`)}
                className="text-xs font-semibold gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" /> View Cached PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default OfflineOrdersPage
