'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Truck, Package, MapPin, CheckCircle2,
  Clock, ShieldAlert, Check, Copy
} from 'lucide-react'

export function DeliveryTrackingAlertsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [pushDelivery, setPushDelivery] = useState(true)
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchActiveDeliveries = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const [prefRes, delRes] = await Promise.all([
        fetch('/api/notifications/preferences', { headers }).then(r => r.json()),
        fetch('/api/notifications/delivery-updates?limit=20', { headers }).then(r => r.json()),
      ])

      if (prefRes.success && prefRes.data) {
        setPushDelivery(prefRes.data.pushDelivery ?? true)
      }
      if (delRes.success && delRes.data) {
        setDeliveries(delRes.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchActiveDeliveries()
  }, [fetchActiveDeliveries])

  const handleToggle = async (val: boolean) => {
    setPushDelivery(val)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ pushDelivery: val }),
      })
    } catch (e) {
      console.error(e)
    }
  }

  const copyTracking = (tracking: string, id: string) => {
    navigator.clipboard.writeText(tracking)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Delivery Tracking Alerts</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-2xl mx-auto w-full space-y-6 pb-24 md:pb-8 lg:max-w-4xl">
        {/* Toggle Master */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Live Courier Push Alerts</p>
              <p className="text-xs text-gray-400">Receive step-by-step courier dispatch pings</p>
            </div>
          </div>
          <Switch checked={pushDelivery} onCheckedChange={handleToggle} />
        </div>

        {/* Active Shipments Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
            Active Consignments ({deliveries.length})
          </h2>

          {deliveries.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center text-gray-500 space-y-2">
              <Truck className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="font-bold text-xs">No active shipments in transit</p>
              <p className="text-[11px]">When suppliers dispatch your orders, live tracking will appear here.</p>
            </div>
          ) : (
            <>
            <div className="md:hidden space-y-3">
            {deliveries.map(del => (
              <div
                key={del.id}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">
                    {del.order?.orderNumber || del.title}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {del.order?.status || 'In Transit'}
                  </span>
                </div>

                <p className="text-xs text-gray-600">{del.message}</p>

                {del.order?.trackingNumber && (
                  <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between text-xs border border-gray-100">
                    <span className="text-gray-500">Waybill: <strong>{del.order.trackingNumber}</strong></span>
                    <button
                      onClick={() => copyTracking(del.order.trackingNumber, del.id)}
                      className="text-emerald-600 font-bold text-[11px] flex items-center gap-1"
                    >
                      {copiedId === del.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      Copy
                    </button>
                  </div>
                )}
              </div>
            ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50/50 text-left">
                    <th className="p-3 text-xs font-semibold text-gray-700">Order</th>
                    <th className="p-3 text-xs font-semibold text-gray-700">Latest Update</th>
                    <th className="p-3 text-xs font-semibold text-gray-700">Status</th>
                    <th className="p-3 text-xs font-semibold text-gray-700">Waybill</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(del => (
                    <tr key={del.id} className="border-t border-gray-100 hover:bg-red-50/30">
                      <td className="p-3 font-medium text-gray-900">{del.order?.orderNumber || del.title}</td>
                      <td className="p-3 text-gray-600">{del.message}</td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap">
                          {del.order?.status || 'In Transit'}
                        </span>
                      </td>
                      <td className="p-3">
                        {del.order?.trackingNumber ? (
                          <button
                            onClick={() => copyTracking(del.order.trackingNumber, del.id)}
                            className="text-emerald-600 font-bold text-[11px] flex items-center gap-1"
                          >
                            {copiedId === del.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                            <span className="font-mono">{del.order.trackingNumber}</span>
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeliveryTrackingAlertsPage
