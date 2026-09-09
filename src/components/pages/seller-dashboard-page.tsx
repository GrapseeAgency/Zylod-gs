'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { 
  Package, ShoppingCart, AlertTriangle, DollarSign, MessageCircle, 
  Plus, Truck, ScanLine, Upload, Store, ArrowRight, BarChart3, Clock, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export const SellerDashboardPage = () => {
  const { navigate } = useNavigationStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/supplier/dashboard');
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const stats = [
    { label: "Today's Sales", value: data?.todaySales || 0, icon: DollarSign, color: "text-green-600" },
    { label: "Pending Orders", value: data?.pendingOrders || 0, icon: ShoppingCart, color: "text-blue-600" },
    { label: "Low Stock Alerts", value: data?.lowStockAlerts || 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Unread Inquiries", value: data?.unreadInquiries || 0, icon: MessageCircle, color: "text-yellow-600" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 dark:bg-gray-900">
      <header className="bg-white px-4 py-4 shadow-sm dark:bg-gray-800 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Seller Hub</h1>
          <p className="text-sm text-gray-500">Welcome back to Zylod Marketplace</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('seller-verification')}>
          Verification
        </Button>
      </header>

      <main className="p-4 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          <ActionBtn icon={Plus} label="Add Item" onClick={() => navigate('add-product')} />
          <ActionBtn icon={Truck} label="Fulfill" onClick={() => navigate('orders')} />
          <ActionBtn icon={ScanLine} label="Scan" onClick={() => navigate('scan-barcode')} />
          <ActionBtn icon={Store} label="Store" onClick={() => navigate('seller-storefront')} />
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, idx) => (
            <Card key={idx} className="border-none shadow-sm dark:bg-gray-800">
              <CardContent className="p-4 flex flex-col items-start gap-2">
                <div className={`p-2 rounded-full bg-gray-100 dark:bg-gray-700 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  {loading ? <Skeleton className="h-6 w-16 mb-1" /> : <div className="text-2xl font-bold dark:text-white">{stat.value}</div>}
                  <div className="text-xs text-gray-500 font-medium">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sales Chart (Placeholder for real chart component) */}
        <Card className="border-none shadow-sm dark:bg-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Revenue Trend</span>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 w-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              {loading ? <Skeleton className="w-full h-full" /> : <span className="text-sm text-gray-400">Chart Visualization</span>}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Orders</h2>
            <Button variant="ghost" size="sm" className="text-primary h-8" onClick={() => navigate('orders')}>
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            ) : (
              data?.recentOrders?.map((order: any) => (
                <Card key={order.id} className="border-none shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm dark:text-white">#{order.orderNumber}</div>
                        <div className="text-xs text-gray-500">{order.customerName} • {order.items} items</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-sm dark:text-white">৳{order.total}</span>
                      <Badge variant={order.status === 'Pending' ? 'destructive' : 'default'} className="text-[10px]">
                        {order.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const ActionBtn = ({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm active:scale-95 transition-transform">
    <div className="text-primary">
      <Icon className="w-6 h-6" />
    </div>
    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
  </button>
);

export default SellerDashboardPage;
