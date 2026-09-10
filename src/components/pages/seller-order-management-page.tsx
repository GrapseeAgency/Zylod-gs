'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { Search, Filter, Download, Package, MoreVertical, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export function SellerOrderManagementPage() {
  const { navigate, goBack } = useNavigationStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = ['All', 'Pending', 'Processing', 'Ready to Ship', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/supplier/orders?status=${activeTab === 'All' ? '' : activeTab}`);
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (err) {
        console.error('Failed to fetch orders', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Order Management</h1>
        <button className="text-[#C8102E] font-medium text-sm flex items-center gap-1">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto hide-scrollbar px-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#C8102E] text-[#C8102E]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Order ID, Buyer, Tracking"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent text-sm"
            />
          </div>
          <button className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600">
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-20 bg-gray-100 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>No orders found for this status</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={order.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">#{order.orderNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        order.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                        order.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'Ready to Ship' ? 'bg-purple-100 text-purple-700' :
                        order.status === 'Shipped' ? 'bg-indigo-100 text-indigo-700' :
                        order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                  <button className="text-gray-400">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4" onClick={() => navigate('seller-order-detail', { orderId: order.id })}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
                      {order.items?.[0]?.imageUrl && (
                        <img src={order.items[0].imageUrl} alt="Product" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {order.buyerCompanyName || order.buyerName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {order.items?.length} items • MOQ Pack x{order.moqPackCount || 1}
                      </p>
                      <p className="text-[#C8102E] font-semibold text-sm mt-1">
                        ৳{order.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded bg-gray-50 border ${order.paymentStatus === 'Paid' ? 'border-green-200 text-green-700' : 'border-orange-200 text-orange-700'}`}>
                      Payment: {order.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                  {order.status === 'Pending' && (
                    <>
                      <button className="py-2 px-4 bg-white border border-[#C8102E] text-[#C8102E] text-sm font-medium rounded-lg" onClick={() => navigate('seller-order-cancellation', { orderId: order.id })}>
                        Reject
                      </button>
                      <button className="py-2 px-4 bg-[#C8102E] text-white text-sm font-medium rounded-lg">
                        Accept Order
                      </button>
                    </>
                  )}
                  {order.status === 'Processing' && (
                    <>
                      <button className="py-2 px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg">
                        Print Slip
                      </button>
                      <button className="py-2 px-4 bg-[#C8102E] text-white text-sm font-medium rounded-lg" onClick={() => navigate('seller-order-fulfillment', { orderId: order.id })}>
                        Book Courier
                      </button>
                    </>
                  )}
                  {order.status !== 'Pending' && order.status !== 'Processing' && (
                    <button className="col-span-2 py-2 px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg" onClick={() => navigate('seller-order-detail', { orderId: order.id })}>
                      View Details
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SellerOrderManagementPage;
