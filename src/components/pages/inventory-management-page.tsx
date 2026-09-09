'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Box, Package, RefreshCw, Plus, Minus } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

interface InventoryItem {
  id: string;
  sku: string;
  title: string;
  stock: number;
  reserved: number;
  location: string;
}

export function InventoryManagementPage() {
  const { goBack, navigate } = useNavigationStore();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/supplier/inventory');
      const data = await res.json();
      setInventory(data.items || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async (id: string, delta: number) => {
    try {
      const res = await fetch('/api/supplier/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ id, delta }] }),
      });
      if (res.ok) {
        setInventory(prev => prev.map(item => 
          item.id === id ? { ...item, stock: item.stock + delta } : item
        ));
      }
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

  const totalStock = inventory.reduce((acc, curr) => acc + curr.stock, 0);
  const lowStockCount = inventory.filter(i => i.stock < 20 && i.stock > 0).length;
  const outOfStockCount = inventory.filter(i => i.stock === 0).length;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Inventory Management</h1>
        </div>
      </div>

      <div className="p-4 md:max-w-5xl md:mx-auto md:p-6 md:pb-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 mb-6">Inventory Management</h1>
        <div className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Package className="w-4 h-4" />
              <span className="text-xs font-medium">Total SKUs</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">{inventory.length}</p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Box className="w-4 h-4" />
              <span className="text-xs font-medium">Total Units</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">{totalStock}</p>
          </div>
          <div className="bg-orange-50 p-3 md:p-4 rounded-xl border border-orange-100 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-orange-600 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">Low Stock</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-orange-700">{lowStockCount}</p>
          </div>
          <div className="bg-red-50 p-3 md:p-4 rounded-xl border border-red-100 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <RefreshCw className="w-4 h-4" />
              <span className="text-xs font-medium">Out of Stock</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-red-700">{outOfStockCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Stock Levels</h2>
          </div>
          
          <div>
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : inventory.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No inventory data available.</div>
            ) : (
              <>
                {/* Mobile card list */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {inventory.map((item) => (
                    <div key={item.id} className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 text-sm line-clamp-1">{item.title}</h3>
                          <p className="text-xs text-gray-500 mt-1">SKU: {item.sku} | Loc: {item.location}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-bold ${item.stock < 20 ? 'text-red-500' : 'text-gray-900'}`}>
                            {item.stock}
                          </span>
                          <p className="text-[10px] text-gray-400">Available</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                        <span className="text-xs font-medium text-gray-600">Quick Adjust</span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleAdjustStock(item.id, -1)}
                            className="p-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                          >
                            <Minus className="w-3 h-3 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleAdjustStock(item.id, 1)}
                            className="p-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                          >
                            <Plus className="w-3 h-3 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-red-50/50 text-left text-xs uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold">SKU</th>
                        <th className="px-4 py-3 font-semibold">Location</th>
                        <th className="px-4 py-3 font-semibold">Available</th>
                        <th className="px-4 py-3 font-semibold">Quick Adjust</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((item) => (
                        <tr key={item.id} className="hover:bg-red-50/30">
                          <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                          <td className="px-4 py-3 text-gray-500">{item.sku}</td>
                          <td className="px-4 py-3 text-gray-500">{item.location}</td>
                          <td className={`px-4 py-3 font-bold ${item.stock < 20 ? 'text-red-500' : 'text-gray-900'}`}>
                            {item.stock}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAdjustStock(item.id, -1)}
                                className="p-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                              >
                                <Minus className="w-3 h-3 text-gray-600" />
                              </button>
                              <button
                                onClick={() => handleAdjustStock(item.id, 1)}
                                className="p-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                              >
                                <Plus className="w-3 h-3 text-gray-600" />
                              </button>
                            </div>
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
        
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button onClick={() => navigate('InventoryRestock')} className="py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 text-center hover:bg-gray-50">
            Bulk Restock
          </button>
          <button onClick={() => navigate('InventoryAuditLog')} className="py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 text-center hover:bg-gray-50">
            Audit Log
          </button>
        </div>
        </div>
      </div>
    </motion.div>
  );
}

export default InventoryManagementPage;
