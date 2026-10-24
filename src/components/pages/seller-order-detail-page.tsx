'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, User, MapPin, Receipt, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

export function SellerOrderDetailPage() {
  const { pageParams, goBack, navigate } = useNavigationStore();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!pageParams?.orderId) {
      goBack();
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/supplier/orders/${pageParams.orderId}`);
        const data = await res.json();
        setOrder(data.order);
      } catch (err) {
        console.error('Failed to fetch order', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [pageParams?.orderId]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 flex items-center justify-center">Loading...</div>;
  }

  if (!order) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 text-center">Order not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-[calc(var(--bottom-nav-h)+140px)]">
      <header className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 sticky top-0 z-10 flex items-center">
        <button onClick={goBack} className="p-1 -ml-1 text-gray-600 dark:text-gray-400 dark:text-gray-500 mr-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Order #{order.orderNumber}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm')}</p>
        </div>
      </header>

      <div className="p-4 space-y-4 md:p-6 md:max-w-3xl md:mx-auto md:pt-6">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 dark:text-gray-100">Order #{order.orderNumber}</h1>
        {/* Status Card */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Status</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{order.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-right">Payment Status</p>
            <p className="font-semibold text-green-600">{order.paymentStatus}</p>
          </div>
        </div>

        {/* Buyer Info */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <User className="w-4 h-4" /> Buyer Details
          </h3>
          <div className="text-sm">
            <p className="font-medium">{order.buyerCompanyName}</p>
            <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500">{order.buyerName}</p>
            <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500">{order.buyerPhone}</p>
          </div>
        </div>

        {/* Shipping Info */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Shipping Address
          </h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
            <p>{order.shippingAddress?.street}</p>
            <p>{order.shippingAddress?.area}, {order.shippingAddress?.city}</p>
            <p>Method: <span className="font-medium text-gray-900 dark:text-gray-100">{order.shippingMethod}</span></p>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Package className="w-4 h-4" /> Order Items
          </h3>
          <div className="space-y-4">
            {order.items?.map((item: any, idx: number) => (
              <div key={idx} className="flex gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-md overflow-hidden">
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-xs">SKU: {item.sku} | Qty: {item.quantity}</p>
                  <div className="mt-1 flex justify-between">
                    <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500">৳{item.price.toLocaleString()} x {item.quantity}</p>
                    <p className="font-medium">৳{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Payment Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400 dark:text-gray-500">
              <span>Subtotal</span>
              <span>৳{order.subtotal?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400 dark:text-gray-500">
              <span>Shipping</span>
              <span>৳{order.shippingFee?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400 dark:text-gray-500">
              <span>VAT/Tax</span>
              <span>৳{order.tax?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 pt-2 border-t border-gray-100 dark:border-gray-800 text-base">
              <span>Total</span>
              <span className="text-[#C8102E]">৳{order.totalAmount?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bottom Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 pb-safe flex gap-3 md:static md:bottom-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        {order.status === 'pending' && (
          <>
            <button 
              className="flex-1 py-3 px-4 bg-white dark:bg-gray-900 border border-gray-300 text-gray-700 dark:text-gray-300 font-medium rounded-xl"
              onClick={() => navigate('seller-order-cancellation', { orderId: order.id })}
            >
              Reject
            </button>
            <button
              onClick={async () => {
                if (!order?.id) return
                setAccepting(true)
                try {
                  const res = await fetch(`/api/supplier/orders/${order.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'confirmed' }),
                  })
                  if (!res.ok) throw new Error('Failed to accept order')
                  const data = await res.json()
                  setOrder((prev: any) => ({ ...prev, status: 'confirmed', ...(data?.order || {}) }))
                  toast.success('Order accepted', { description: 'The buyer has been notified. Proceed to fulfillment.' })
                } catch (err) {
                  console.error(err)
                  toast.error('Could not accept order')
                } finally {
                  setAccepting(false)
                }
              }}
              disabled={accepting}
              className="flex-1 py-3 px-4 bg-[#C8102E] text-white font-medium rounded-xl shadow-sm disabled:opacity-60"
              aria-label="Accept this order"
            >
              {accepting ? 'Accepting…' : 'Accept Order'}
            </button>
          </>
        )}
        {order.status === 'processing' && (
          <button 
            className="w-full py-3 px-4 bg-[#C8102E] text-white font-medium rounded-xl shadow-sm"
            onClick={() => navigate('seller-order-fulfillment', { orderId: order.id })}
          >
            Fulfill Order
          </button>
        )}
      </div>
    </div>
  );
}

export default SellerOrderDetailPage;
