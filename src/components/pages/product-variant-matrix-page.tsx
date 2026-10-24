'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function ProductVariantMatrixPage() {
  const { goBack } = useNavigationStore();
  const [attributes, setAttributes] = useState<{ name: string; values: string[] }[]>([
    { name: 'Color', values: ['Red', 'Blue', 'Black'] },
    { name: 'Size', values: ['M', 'L', 'XL'] }
  ]);

  const addAttribute = () => {
    setAttributes([...attributes, { name: '', values: [] }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttributeName = (index: number, name: string) => {
    const newAttrs = [...attributes];
    newAttrs[index].name = name;
    setAttributes(newAttrs);
  };

  const updateAttributeValues = (index: number, valuesStr: string) => {
    const newAttrs = [...attributes];
    newAttrs[index].values = valuesStr.split(',').map(s => s.trim()).filter(Boolean);
    setAttributes(newAttrs);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Variant Matrix</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 md:p-6 md:max-w-4xl md:mx-auto md:pt-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 dark:text-gray-100">Variant Matrix</h1>
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Attributes</h2>
            <button onClick={addAttribute} className="text-primary text-sm font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="space-y-4">
            {attributes.map((attr, idx) => (
              <div key={idx} className="p-3 border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 space-y-3">
                <div className="flex justify-between items-center">
                  <input 
                    type="text" 
                    value={attr.name} 
                    onChange={(e) => updateAttributeName(idx, e.target.value)}
                    placeholder="Attribute Name (e.g., Size)"
                    className="bg-transparent font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:border-b border-primary"
                  />
                  <button onClick={() => removeAttribute(idx)} className="text-gray-400 dark:text-gray-500 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input 
                  type="text" 
                  value={attr.values.join(', ')}
                  onChange={(e) => updateAttributeValues(idx, e.target.value)}
                  placeholder="Values separated by commas (e.g., S, M, L)"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
             <h2 className="font-semibold text-gray-900 dark:text-gray-100">Generated Combinations</h2>
          </div>
          <div className="p-4 text-sm text-gray-600 dark:text-gray-400 text-center">
             Combinations matrix will be dynamically generated based on the attributes above.
          </div>
        </div>

        <button className="w-full md:w-auto md:px-10 bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2">
          <Save className="w-5 h-5" />
          Save Matrix
        </button>
      </div>
    </motion.div>
  );
}

export default ProductVariantMatrixPage;
