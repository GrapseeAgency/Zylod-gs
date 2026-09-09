'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function SellerEditProductPage() {
  const { goBack, pageParams } = useNavigationStore();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    brand: '',
    hsCode: '',
    basePrice: '',
    unitType: 'piece',
    moq: '',
    description: '',
    isActive: true,
  });

  const [pricingTiers, setPricingTiers] = useState([
    { minQty: 0, maxQty: 0, price: '' }
  ]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!pageParams?.productId) return;
      try {
        const response = await fetch(`/api/supplier/products/${pageParams.productId}`);
        const data = await response.json();
        setFormData({
          title: data.title || '',
          category: data.category || '',
          brand: data.brand || '',
          hsCode: data.hsCode || '',
          basePrice: data.basePrice || '',
          unitType: data.unitType || 'piece',
          moq: data.moq || '',
          description: data.description || '',
          isActive: data.isActive ?? true,
        });
        setPricingTiers(data.pricingTiers || [{ minQty: 0, maxQty: 0, price: '' }]);
      } catch (error) {
        console.error('Failed to fetch product', error);
      } finally {
        setFetching(false);
      }
    };
    fetchProduct();
  }, [pageParams?.productId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleTierChange = (index: number, field: string, value: string) => {
    const newTiers = [...pricingTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setPricingTiers(newTiers);
  };

  const addTier = () => {
    setPricingTiers([...pricingTiers, { minQty: 0, maxQty: 0, price: '' }]);
  };

  const removeTier = (index: number) => {
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageParams?.productId) return;
    setLoading(true);
    try {
      await fetch(`/api/supplier/products/${pageParams.productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, pricingTiers }),
      });
      goBack();
    } catch (error) {
      console.error('Failed to update product', error);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Edit Product</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Basic Information</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Active Listing</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${formData.isActive ? 'bg-primary' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isActive ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
              </label>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Product Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Category ID</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Base Price</label>
                <input
                  type="number"
                  name="basePrice"
                  value={formData.basePrice}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
             <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Pricing Tiers</h3>
              <button type="button" onClick={addTier} className="text-primary text-sm font-medium flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add Tier
              </button>
            </div>
            
            <div className="space-y-3">
              {pricingTiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={tier.minQty}
                    onChange={(e) => handleTierChange(index, 'minQty', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={tier.maxQty}
                    onChange={(e) => handleTierChange(index, 'maxQty', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={tier.price}
                    onChange={(e) => handleTierChange(index, 'price', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <button type="button" onClick={() => removeTier(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            {loading ? 'Saving...' : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

export default SellerEditProductPage;
