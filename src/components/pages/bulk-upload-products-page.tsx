'use client';
import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { UploadCloud, FileSpreadsheet, History } from 'lucide-react';

export function BulkUploadProductsPage() {
  const { navigate, goBack } = useNavigationStore();
  const [uploading, setUploading] = useState(false);

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => setUploading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center justify-between md:hidden">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4">←</button>
          <h1 className="text-xl font-bold">Bulk Upload</h1>
        </div>
        <button onClick={() => navigate('bulk-upload-history')}>
          <History className="w-6 h-6" />
        </button>
      </header>
      <main className="flex-1 p-4 md:p-6 md:py-8">
        {/* Desktop page heading (mobile uses the colored bar above) */}
        <div className="hidden md:flex items-center justify-between max-w-3xl mx-auto mb-6">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-sm font-medium text-gray-600 hover:text-gray-900">Back</button>
            <h1 className="text-2xl font-bold text-gray-900">Bulk Upload</h1>
          </div>
          <button onClick={() => navigate('bulk-upload-history')} className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <History className="w-4 h-4" />
            Upload History
          </button>
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 md:max-w-3xl md:mx-auto md:space-y-8">
          <button onClick={() => navigate('bulk-upload-template')} className="w-full bg-white border border-gray-200 p-4 rounded-lg flex items-center text-left shadow-sm">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <FileSpreadsheet className="text-blue-600 w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Download Template</h3>
              <p className="text-sm text-gray-500">Get category specific Excel/CSV templates</p>
            </div>
          </button>

          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 md:p-12 text-center">
            <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-bold text-gray-800 mb-2">Drag and drop your file here</h3>
            <p className="text-sm text-gray-500 mb-4">Support CSV, XLSX files</p>
            <button onClick={handleUpload} className="bg-primary text-white px-6 py-2 rounded font-semibold">
              {uploading ? 'Uploading...' : 'Browse File'}
            </button>
          </div>
          
          <button onClick={() => navigate('bulk-price-update')} className="w-full bg-gray-800 text-white p-4 rounded-lg font-bold">
            Quick Bulk Price & MOQ Update
          </button>
        </motion.div>
      </main>
    </div>
  );
}

export default BulkUploadProductsPage;