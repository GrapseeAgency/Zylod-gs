'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Filter, MoreVertical, Plus, Edit, Eye, Copy, Trash } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

interface Product {
  id: string;
  title: string;
  category: string;
  basePrice: number;
  stock: number;
  status: 'active' | 'draft' | 'out_of_stock';
  sales: number;
  views: number;
  imageUrl?: string;
}

export function ProductListingsManagerPage() {
  const { goBack, navigate } = useNavigationStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = ['All', 'Active', 'Draft', 'Out of Stock', 'Pending Approval'];

  useEffect(() => {
    fetchProducts();
  }, [activeTab]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier/products?status=${activeTab !== 'All' ? activeTab.toLowerCase().replace(' ', '_') : ''}`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id: string) => {
    navigate('SellerEditProduct', { productId: id });
  };

  const filteredProducts = products.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Product Listings</h1>
          </div>
          <button 
            onClick={() => navigate('SellerAddProduct')}
            className="bg-primary text-white p-2 rounded-lg flex items-center gap-1 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4 md:p-6 md:pt-4 md:max-w-6xl md:mx-auto">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Product Listings</h1>
          <button
            onClick={() => navigate('SellerAddProduct')}
            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search SKUs, titles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button className="p-2 bg-white border border-gray-200 rounded-xl">
            <Filter className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 animate-pulse flex gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-xs">No Img</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{product.title}</h3>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary">${product.basePrice.toFixed(2)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        product.stock > 20 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {product.stock} in stock
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex grid grid-cols-4 gap-2">
                   <button onClick={() => handleEdit(product.id)} className="flex flex-col items-center justify-center p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
                     <Edit className="w-4 h-4 mb-1" />
                     <span className="text-xs font-medium">Edit</span>
                   </button>
                   <button className="flex flex-col items-center justify-center p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
                     <Eye className="w-4 h-4 mb-1" />
                     <span className="text-xs font-medium">View</span>
                   </button>
                   <button className="flex flex-col items-center justify-center p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
                     <Copy className="w-4 h-4 mb-1" />
                     <span className="text-xs font-medium">Dup</span>
                   </button>
                   <button className="flex flex-col items-center justify-center p-2 text-red-500 hover:bg-red-50 rounded-lg">
                     <Trash className="w-4 h-4 mb-1" />
                     <span className="text-xs font-medium">Del</span>
                   </button>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                No products found.
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ProductListingsManagerPage;
