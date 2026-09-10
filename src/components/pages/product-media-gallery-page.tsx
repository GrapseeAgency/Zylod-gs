'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Image as ImageIcon } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function ProductMediaGalleryPage() {
  const { goBack } = useNavigationStore();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Media Gallery</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 md:p-6 md:max-w-4xl md:mx-auto md:pt-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Media Gallery</h1>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
           <h2 className="font-semibold text-gray-900">Upload Media</h2>
           
           <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 md:p-12 text-center bg-gray-50">
             <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
             <p className="text-sm font-medium text-gray-700">Drag & Drop or Click to Upload</p>
             <p className="text-xs text-gray-500 mt-1">Supports Images, Videos & 3D .glb files</p>
           </div>
           
           <div className="space-y-2">
             <label className="text-sm font-medium text-gray-700">Video URL (Optional)</label>
             <input type="text" placeholder="https://youtube.com/..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
           </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Gallery</h2>
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                <ImageIcon className="w-6 h-6 text-gray-300" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default ProductMediaGalleryPage;
