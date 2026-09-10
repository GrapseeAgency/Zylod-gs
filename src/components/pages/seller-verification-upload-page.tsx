'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Camera, UploadCloud, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const SellerVerificationUploadPage = () => {
  const { goBack } = useNavigationStore();
  const [docType, setDocType] = useState('trade_license');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docType);
      
      const res = await fetch('/api/supplier/verification', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) setSuccess(true);
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Upload Successful</h2>
        <p className="text-gray-500 mb-8">Your document is now under review. We will notify you once verified.</p>
        <Button className="w-full" onClick={goBack}>Back to Verification Hub</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="md:hidden bg-white px-4 py-4 shadow-sm dark:bg-gray-800 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Upload Document</h1>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Upload Document</h1>

      <main className="flex-1 p-4 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Document Type</label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="w-full bg-white dark:bg-gray-800 h-12">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trade_license">Trade License</SelectItem>
              <SelectItem value="tax_tin">Tax TIN Certificate</SelectItem>
              <SelectItem value="nid_front">NID (Front)</SelectItem>
              <SelectItem value="nid_back">NID (Back)</SelectItem>
              <SelectItem value="fire_safety">Fire Safety License</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload File</label>
          
          <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 p-8 flex flex-col items-center justify-center text-center">
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} accept="image/*,.pdf" />
            
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <FileText className="w-12 h-12 text-primary" />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">Drag & drop or tap to browse</p>
                  <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG, PDF (Max 5MB)</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-center mt-4">
            <Button variant="outline" className="w-full flex gap-2 h-12">
              <Camera className="w-4 h-4" /> Use Camera
            </Button>
          </div>
        </div>
      </main>

      <div className="p-4 bg-white dark:bg-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Button className="w-full h-12 text-lg" disabled={!file || uploading} onClick={handleUpload}>
          {uploading ? 'Uploading...' : 'Submit Document'}
        </Button>
      </div>
    </div>
  );
};

export default SellerVerificationUploadPage;
