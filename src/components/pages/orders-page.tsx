'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Menu, Search, QrCode, FileText, Truck, RotateCcw,
  MessageSquare, Package, ChevronRight, CheckCircle2,
  Clock, ShieldAlert, ShoppingBag
} from 'lucide-react'

interface OrderCardItem {
  id: string
  poNumber: string
  date: string
  itemsCount: number
  totalAmount: number
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled'
  carrier?: string
  estShipOrDel?: string
  signedBy?: string
  supplierName: string
  firstItemTitle: string
  firstItemImage?: string
}

export function OrdersPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'processing' | 'shipped' | 'delivered'>('all')
  const [loading, setLoading] = useState(false)

  // Real dataset structure matching wholesale b2b purchases
  const [orders, setOrders] = useState<OrderCardItem[]>([
    {
      id: 'ord-1',
      poNumber: 'PO #WH-99281-A',
      date: 'Oct 24, 2023',
      itemsCount: 14,
      totalAmount: 1820.00,
      status: 'shipped',
      carrier: 'FastFreight Ltd.',
      supplierName: 'ProKitchen Equipments Inc.',
      firstItemTitle: 'Industrial Grade Blenders (Pallet of 14)',
      firstItemImage: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'ord-2',
      poNumber: 'PO #WH-99415-B',
      date: 'Oct 26, 2023',
      itemsCount: 250,
      totalAmount: 1850.00,
      status: 'processing',
      estShipOrDel: 'Est. Ship: Oct 28',
      supplierName: 'BrightTech Wholesale',
      firstItemTitle: 'Assorted LED Shop Lights (Master Carton)',
    },
    {
      id: 'ord-3',
      poNumber: 'PO #WH-98801-C',
      date: 'Oct 15, 2023',
      itemsCount: 50,
      totalAmount: 3100.00,
      status: 'delivered',
      signedBy: 'J. Doe',
      supplierName: 'SteelCore Fasteners Ltd.',
      firstItemTitle: 'Grade 8 Heavy Hex Bolts & Nut Kits',
      firstItemImage: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop&q=80',
    },
  ])

  useEffect(() => {
    let mounted = true
    async function loadApiOrders() {
      try {
        const res = await fetch('/api/orders/my-orders')
        if (res.ok) {
          const json = await res.json()
          const data = json.data || json
          if (mounted && Array.isArray(data) && data.length > 0) {
            const mapped: OrderCardItem[] = data.map((o: any) => ({
              id: o.id || o.order_number,
              poNumber: o.order_number ? `PO #${o.order_number}` : 'PO #WH-99281-A',
              date: new Date(o.placed_at || o.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              itemsCount: o.sub_orders?.reduce((acc: number, so: any) => acc + (so.items?.length || 1), 0) || 1,
              totalAmount: o.total_amount || 0,
              status: (o.status || 'processing').toLowerCase(),
              carrier: 'FastFreight Ltd.',
              supplierName: o.sub_orders?.[0]?.supplier?.company_name || 'Wholesale Supplier',
              firstItemTitle: o.sub_orders?.[0]?.items?.[0]?.product?.name || 'Industrial Equipment Kit',
              firstItemImage: o.sub_orders?.[0]?.items?.[0]?.product?.images?.[0]?.url,
            }))
            setOrders(mapped)
          }
        }
      } catch (err) {
        console.error('Failed to load orders API:', err)
      }
    }
    loadApiOrders()
    return () => { mounted = false }
  }, [])

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchTab = activeTab === 'all' || o.status === activeTab
      const matchQuery =
        !searchQuery.trim() ||
        o.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.firstItemTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
      return matchTab && matchQuery
    })
  }, [orders, activeTab, searchQuery])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Menu">
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Search">
            <Search className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 md:space-y-5 max-w-lg mx-auto lg:max-w-5xl">
        {/* Title */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">My Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage and track your wholesale purchases.
          </p>
        </div>

        {/* Search PO / Item Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO#, Item, or Supplier..."
            className="h-11 pl-10 pr-10 rounded-2xl bg-white border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400"
          />
          <QrCode className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Orders' },
            { key: 'processing', label: 'Processing' },
            { key: 'shipped', label: 'Shipped' },
            { key: 'delivered', label: 'Delivered' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List (mobile cards) */}
        <div className="space-y-3.5 md:hidden">
          {filteredOrders.map((order) => {
            const isShipped = order.status === 'shipped'
            const isProcessing = order.status === 'processing'
            const isDelivered = order.status === 'delivered'

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-900 block">
                      {order.poNumber}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      {order.date} • {order.itemsCount} Items
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {isProcessing && (
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                          PROCESSING
                        </span>
                      )}
                      {isDelivered && (
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                          DELIVERED
                        </span>
                      )}
                      <span className="text-sm font-black text-primary">
                        {formatPrice(order.totalAmount)}
                      </span>
                    </div>

                    {isShipped && order.carrier && (
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                        Via {order.carrier}
                      </span>
                    )}
                    {isProcessing && order.estShipOrDel && (
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                        {order.estShipOrDel}
                      </span>
                    )}
                    {isDelivered && order.signedBy && (
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                        Signed by: {order.signedBy}
                      </span>
                    )}
                  </div>
                </div>

                {/* Product Summary Row */}
                <div className="flex gap-3 items-center pt-1">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {order.firstItemImage ? (
                      <img src={order.firstItemImage} alt={order.firstItemTitle} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                      {order.firstItemTitle}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Supplier: {order.supplierName}
                    </p>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-50 flex items-center gap-2.5">
                  {isShipped && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => navigate('order-invoice', { orderId: order.id })}
                        className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-10 rounded-2xl text-xs flex items-center justify-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Invoice
                      </Button>
                      <Button
                        onClick={() => navigate('track-order', { orderId: order.id })}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        Track Order
                      </Button>
                    </>
                  )}

                  {isProcessing && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => navigate('order-detail', { orderId: order.id })}
                        className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-10 rounded-2xl text-xs"
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => navigate('live-chat')}
                        className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-10 rounded-2xl text-xs flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Contact Supplier
                      </Button>
                    </>
                  )}

                  {isDelivered && (
                    <div className="w-full flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => navigate('cart')}
                        className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-10 px-5 rounded-2xl text-xs flex items-center gap-1.5"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-primary" />
                        Reorder
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Orders Table (desktop) */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-50/50 text-left">
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">PO Number</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Item</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Total</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => {
                const isShipped = order.status === 'shipped'
                const isProcessing = order.status === 'processing'
                const isDelivered = order.status === 'delivered'

                return (
                  <tr key={order.id} className="hover:bg-red-50/30">
                    <td className="px-4 py-3 font-black text-slate-900 whitespace-nowrap">{order.poNumber}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{order.date} • {order.itemsCount} Items</td>
                    <td className="px-4 py-3 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {order.firstItemImage ? (
                            <img src={order.firstItemImage} alt={order.firstItemTitle} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">{order.firstItemTitle}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">Supplier: {order.supplierName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-primary whitespace-nowrap">{formatPrice(order.totalAmount)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {isShipped && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => navigate('order-invoice', { orderId: order.id })}
                              className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-8 px-3 rounded-lg text-xs"
                            >
                              Invoice
                            </Button>
                            <Button
                              onClick={() => navigate('track-order', { orderId: order.id })}
                              className="bg-primary hover:bg-primary/90 text-white font-bold h-8 px-3 rounded-lg text-xs shadow-xs"
                            >
                              Track
                            </Button>
                          </>
                        )}
                        {isProcessing && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => navigate('order-detail', { orderId: order.id })}
                              className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-8 px-3 rounded-lg text-xs"
                            >
                              View Details
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => navigate('live-chat')}
                              className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-8 px-3 rounded-lg text-xs"
                            >
                              Contact Supplier
                            </Button>
                          </>
                        )}
                        {isDelivered && (
                          <Button
                            variant="outline"
                            onClick={() => navigate('cart')}
                            className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-8 px-3 rounded-lg text-xs"
                          >
                            Reorder
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400">
              No orders match your search or filter.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
