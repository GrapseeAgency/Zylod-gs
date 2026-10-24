'use client';

import React, { useState, useEffect } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Camera, UploadCloud, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/* Uploads a real KYC document via POST /api/supplier/verification (multipart).
 * Only document types the sellerVerificationDocuments model actually supports
 * are offered, and server errors are surfaced verbatim — never a fake
 * "Upload Successful". */

const DOC_TYPES = [
  { value: 'trade_license', label: 'Trade License' },
  { value: 'tin_certificate', label: 'TIN Certificate' },
  { value: 'nid_front', label: 'NID (Front)' },
  { value: 'nid_back', label: 'NID (Back)' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'utility_bill', label: 'Utility Bill' },
] as const;

const MAX_MB = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export const SellerVerificationUploadPage = () => {
  const { goBack, pageParams } = useNavigationStore();
  const [docType, setDocType] = useState<string>('trade_license');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Deep-link support: the Verification Hub passes ?docType=<type>
  useEffect(() => {
    if (pageParams.docType && DOC_TYPES.some((t) => t.value === pageParams.docType)) {
      setDocType(pageParams.docType);
    }
  }, [pageParams.docType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Choose a document image first.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large (max ${MAX_MB}MB).`);
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setError('Only JPG, PNG, or WebP images are accepted.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docType);

      const res = await fetch('/api/supplier/verification', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setSuccess(true);
      } else {
        setError(json.error || `Upload failed (${res.status}). Please try again.`);
      }
    } catch (e) {
      console.error(e);
      setError('Could not reach the upload service. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Document submitted</h2>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-8">Your document is now pending review. We will notify you once it is verified.</p>
        <Button className="w-full" onClick={goBack}>Back to Verification Hub</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 dark:bg-gray-900 flex flex-col">
      <header className="md:hidden bg-white dark:bg-gray-900 px-4 py-4 shadow-sm dark:bg-gray-800 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full dark:hover:bg-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">Upload Document</h1>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Upload Document</h1>

      <main className="flex-1 p-4 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Document Type</label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="w-full bg-white dark:bg-gray-900 dark:bg-gray-800 h-12">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload File</label>
          
          <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 dark:bg-gray-800 p-8 flex flex-col items-center justify-center text-center">
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} accept="image/jpeg,image/png,image/webp" />
            
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <FileText className="w-12 h-12 text-primary" />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100 dark:text-white line-clamp-1">{file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/5 text-primary flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100 dark:text-white">Drag &amp; drop or tap to browse</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Supports JPG, PNG, WebP (Max {MAX_MB}MB)</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </p>
          )}
          
          <div className="flex justify-center mt-4">
            <Button variant="outline" className="w-full flex gap-2 h-12">
              <Camera className="w-4 h-4" /> Use Camera
            </Button>
          </div>
        </div>
      </main>

      <div className="p-4 bg-white dark:bg-gray-900 dark:bg-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Button className="w-full h-12 text-lg" disabled={!file || uploading} onClick={handleUpload}>
          {uploading ? 'Uploading…' : 'Submit Document'}
        </Button>
      </div>
    </div>
  );
};

export default SellerVerificationUploadPage;
