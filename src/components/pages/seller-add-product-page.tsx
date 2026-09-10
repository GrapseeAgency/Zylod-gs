'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Plus, Trash2, Save } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function SellerAddProductPage() {
  const { goBack, navigate } = useNavigationStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    brand: '',
    hsCode: '',
    basePrice: '',
    unitType: 'piece',
    moq: '',
    sampleAvailable: false,
    samplePrice: '',
    description: '',
    weight: '',
    leadTimeDays: '',
  });

  const [pricingTiers, setPricingTiers] = useState([
    { minQty: 100, maxQty: 499, price: '' }
  ]);

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
    setLoading(true);
    try {
      const response = await fetch('/api/supplier/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, pricingTiers }),
      });
      if (response.ok) {
        navigate('ProductListingsManager');
      }
    } catch (error) {
      console.error('Failed to create product', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Add New Product</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6 md:p-6 md:pt-6">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Add New Product</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Basic Information</h2>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Product Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Premium Cotton T-Shirt"
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
                <label className="text-sm font-medium text-gray-700">Brand</label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">HS Code</label>
              <input
                type="text"
                name="hsCode"
                value={formData.hsCode}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Pricing & Inventory</h2>
            
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Unit Type</label>
                <select
                  name="unitType"
                  value={formData.unitType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="piece">Piece</option>
                  <option value="kg">Kg</option>
                  <option value="meter">Meter</option>
                  <option value="carton">Carton</option>
                  <option value="set">Set</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">MOQ</label>
                <input
                  type="number"
                  name="moq"
                  value={formData.moq}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Tiered Wholesale Pricing</h3>
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
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Media & Description</h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Upload Product Images</p>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Specifications / Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
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
                Publish Product
              </>
            )}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

export default SellerAddProductPage;
