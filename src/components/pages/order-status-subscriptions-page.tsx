'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Package, Check, CheckCircle2,
  Clock, Truck, RefreshCw
} from 'lucide-react'

export function OrderStatusSubscriptionsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [pushOrders, setPushOrders] = useState(true)
  const [emailOrders, setEmailOrders] = useState(true)
  const [stepConfirm, setStepConfirm] = useState(true)
  const [stepPacked, setStepPacked] = useState(true)
  const [stepShipped, setStepShipped] = useState(true)
  const [stepDelivered, setStepDelivered] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/notifications/preferences', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPushOrders(data.data.pushOrderUpdates ?? true)
          setEmailOrders(data.data.emailOrderUpdates ?? true)
        }
      })
      .catch(console.error)
  }, [token])

  const handleToggle = async (key: 'pushOrderUpdates' | 'emailOrderUpdates', val: boolean) => {
    if (key === 'pushOrderUpdates') setPushOrders(val)
    if (key === 'emailOrderUpdates') setEmailOrders(val)

    try {
      setSaving(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ [key]: val }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Order Status Subscriptions</span>
        </div>

        {saved && (
          <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto lg:max-w-3xl w-full space-y-6 pb-24 md:pb-8">
        {saved && (
          <div className="hidden md:flex w-fit items-center gap-1 self-start text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Saved
          </div>
        )}

        {/* Channel Master */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2.5">
            Master Channels
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-gray-900">Push Notifications</p>
              <p className="text-[11px] text-gray-400">Immediate mobile push for order changes</p>
            </div>
            <Switch
              checked={pushOrders}
              onCheckedChange={(val) => handleToggle('pushOrderUpdates', val)}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div>
              <p className="text-xs sm:text-sm font-bold text-gray-900">Email Invoices &amp; Receipts</p>
              <p className="text-[11px] text-gray-400">PDF invoice and fulfillment summaries sent to inbox</p>
            </div>
            <Switch
              checked={emailOrders}
              onCheckedChange={(val) => handleToggle('emailOrderUpdates', val)}
            />
          </div>
        </div>

        {/* Milestone Triggers */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2.5">
            Fulfillment Milestones
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 md:gap-x-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-gray-800">Order Confirmed by Factory</span>
              </div>
              <Switch checked={stepConfirm} onCheckedChange={setStepConfirm} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-gray-800">Packed in Warehouse &amp; QC Verified</span>
              </div>
              <Switch checked={stepPacked} onCheckedChange={setStepPacked} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-gray-800">Dispatched via Courier (Tracking Available)</span>
              </div>
              <Switch checked={stepShipped} onCheckedChange={setStepShipped} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs font-bold text-gray-800">Delivered</span>
              </div>
              <Switch checked={stepDelivered} onCheckedChange={setStepDelivered} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderStatusSubscriptionsPage
