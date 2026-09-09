'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function ProductSpecEditorPage() {
  const { goBack } = useNavigationStore();
  const [specs, setSpecs] = useState([{ key: 'Material Grade', value: '' }]);

  const addSpec = () => setSpecs([...specs, { key: '', value: '' }]);
  const removeSpec = (index: number) => setSpecs(specs.filter((_, i) => i !== index));

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Technical Specs</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 md:p-6 md:max-w-3xl md:mx-auto md:pt-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Technical Specs</h1>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
           <div className="flex justify-between items-center mb-4">
             <h2 className="font-semibold text-gray-900">Specifications</h2>
             <button onClick={addSpec} className="text-primary text-sm font-medium flex items-center gap-1">
               <Plus className="w-4 h-4" /> Add Spec
             </button>
           </div>
           
           <div className="space-y-3">
             {specs.map((spec, i) => (
               <div key={i} className="flex items-center gap-2">
                 <input 
                   type="text" 
                   placeholder="Name (e.g., Material)" 
                   value={spec.key}
                   onChange={(e) => {
                     const newSpecs = [...specs];
                     newSpecs[i].key = e.target.value;
                     setSpecs(newSpecs);
                   }}
                   className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                 />
                 <input 
                   type="text" 
                   placeholder="Value" 
                   value={spec.value}
                   onChange={(e) => {
                     const newSpecs = [...specs];
                     newSpecs[i].value = e.target.value;
                     setSpecs(newSpecs);
                   }}
                   className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                 />
                 <button onClick={() => removeSpec(i)} className="p-2 text-gray-400 hover:text-red-500">
                   <X className="w-5 h-5" />
                 </button>
               </div>
             ))}
           </div>
        </div>

        <button className="w-full md:w-auto md:px-10 bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2">
          <Save className="w-5 h-5" />
          Save Specifications
        </button>
      </div>
    </motion.div>
  );
}

export default ProductSpecEditorPage;
