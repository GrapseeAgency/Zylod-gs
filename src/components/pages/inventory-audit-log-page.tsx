'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function InventoryAuditLogPage() {
  const { goBack } = useNavigationStore();

  const logs = [
    { id: '1', action: 'Restock Intake', delta: '+500', user: 'Admin User', date: '2023-10-24 14:30', item: 'Cotton T-Shirt (SKU-1001)' },
    { id: '2', action: 'Manual Adjustment', delta: '-5', user: 'Warehouse Mgr', date: '2023-10-23 09:15', item: 'Denim Jeans (SKU-2004)' },
    { id: '3', action: 'Order Fulfillment', delta: '-120', user: 'System', date: '2023-10-22 18:45', item: 'Cotton T-Shirt (SKU-1001)' },
  ];

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
          <h1 className="text-lg font-bold text-gray-900">Audit Log</h1>
        </div>
      </div>

      <div className="p-4 md:max-w-4xl md:mx-auto md:p-6 md:pb-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 mb-6">Audit Log</h1>
        <div className="space-y-4 md:space-y-6">
        {/* Mobile card list */}
        <div className="space-y-4 md:hidden">
          {logs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{log.action}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{log.item}</p>
                </div>
                <span className={`font-bold ${log.delta.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {log.delta}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{log.date}</span>
                </div>
                <div>By: {log.user}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-50/50 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Change</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-red-50/30">
                  <td className="px-4 py-3 font-semibold text-gray-900">{log.action}</td>
                  <td className="px-4 py-3 text-gray-500">{log.item}</td>
                  <td className={`px-4 py-3 font-bold ${log.delta.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {log.delta}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{log.user}</td>
                  <td className="px-4 py-3 text-gray-500">{log.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </motion.div>
  );
}

export default InventoryAuditLogPage;
