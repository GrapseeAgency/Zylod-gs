'use client'

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  X, UploadCloud, Play, Plus, CheckCircle2,
  Image as ImageIcon, Film, FileCheck
} from 'lucide-react'

interface MediaFile {
  id: string
  type: 'image' | 'video'
  url: string
  duration?: string
  uploading?: boolean
  progress?: number
}

export function UploadReviewPhotosPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || ''
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mediaList, setMediaList] = useState<MediaFile[]>([])
  const [uploadError, setUploadError] = useState('')

  const handleRemove = (id: string) => {
    setMediaList((prev) => prev.filter((m) => m.id !== id))
  }

  const handleClearAll = () => {
    setMediaList([])
  }

  // REAL upload: files go to /api/uploads/review-media and the returned URL
  // is an actual file served by the backend — never a session-local blob URL.
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadError('')

    for (const file of Array.from(files)) {
      const tempId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setMediaList((prev) => [
        ...prev,
        {
          id: tempId,
          type: file.type.startsWith('video') ? 'video' : 'image',
          url: '',
          uploading: true,
          progress: 0,
        },
      ])

      try {
        const form = new FormData()
        form.append('file', file)
        if (productId) form.append('productId', productId)
        const res = await fetch('/api/uploads/review-media', {
          method: 'POST',
          credentials: 'include',
          body: form,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.success) {
          setUploadError(data?.error || `Upload failed (HTTP ${res.status}).`)
          setMediaList((prev) => prev.filter((m) => m.id !== tempId))
          continue
        }
        const url: string = data.data.url
        setMediaList((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, url, uploading: false, progress: 100 } : m
          )
        )
      } catch {
        setUploadError('Network error during upload — check your connection and retry.')
        setMediaList((prev) => prev.filter((m) => m.id !== tempId))
      }
    }

    // allow re-selecting the same file
    e.target.value = ''
  }

  const handleSubmit = () => {
    // Only fully uploaded media counts; half-uploaded items block submission
    const pending = mediaList.some((m) => m.uploading || !m.url)
    if (pending) {
      setUploadError('Some files are still uploading. Wait for them to finish or remove them.')
      return
    }
    // Hand the real uploaded URLs to the review flow
    try {
      sessionStorage.setItem('zylod-review-media', JSON.stringify(mediaList.map((m) => ({ type: m.type, url: m.url }))))
    } catch {
      // storage unavailable — media simply won't carry over, no fake fallback
    }
    navigate('write-review', { productId })
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3.5 shadow-xs">
        <div className="relative flex items-center justify-center">
          <button
            onClick={goBack}
            className="absolute left-0 p-1 text-slate-700 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-bold text-primary">Upload Media</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Upload Media</h1>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-5">
        {/* Title & Intro */}
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Add Photos or Videos
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Help other buyers make informed decisions. Upload high-quality images of the product you received.
          </p>
        </div>

        {/* Upload Dropzone Box */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-rose-200 bg-white rounded-3xl p-6 text-center shadow-xs cursor-pointer hover:border-primary transition-all flex flex-col items-center justify-center"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="w-12 h-12 rounded-full bg-rose-50 text-primary flex items-center justify-center mb-3">
            <UploadCloud className="h-6 w-6" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 mb-1">
            Click or drag files here to upload
          </h3>
          <p className="text-[10px] text-slate-400 mb-4">
            Supports JPG, PNG, and MP4 (Max 50MB)
          </p>
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-sm"
          >
            Select Files
          </Button>
        </div>

        {/* Selected Media Section */}
        <div>
          {uploadError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-2xl p-3" role="alert">
              <p className="text-xs font-bold text-red-700">{uploadError}</p>
            </div>
          )}
          {mediaList.length === 0 && !uploadError && (
            <p className="text-[11px] text-slate-500 text-center py-6">
              No media selected. Upload real photos or videos of the product you received — nothing is
              pre-filled or faked.
            </p>
          )}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900">
              Selected Media ({mediaList.length})
            </h3>
            {mediaList.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs font-bold text-primary hover:underline"
              >
                Clear All
              </button>
            )}
          </div>

          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3">
            {mediaList.map((item) => (
              <div
                key={item.id}
                className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs group"
              >
                {/* Media Image / Thumbnail */}
                <img
                  src={item.url}
                  alt="Upload preview"
                  className={`w-full h-full object-cover ${
                    item.uploading ? 'filter blur-xs opacity-75' : ''
                  }`}
                />

                {/* Uploading Overlay */}
                {item.uploading && (
                  <div className="absolute inset-0 bg-black/30 backdrop-blur-2xs flex flex-col items-center justify-center p-3 text-center">
                    <span className="text-[10px] font-bold text-white mb-2 bg-black/40 px-2 py-0.5 rounded-full">
                      Uploading... {item.progress}%
                    </span>
                    <div className="w-full bg-white/40 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Video Play Button & Duration */}
                {item.type === 'video' && !item.uploading && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center">
                        <Play className="h-4 w-4 fill-white ml-0.5" />
                      </div>
                    </div>
                    {item.duration && (
                      <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {item.duration}
                      </span>
                    )}
                  </>
                )}

                {/* Remove (X) Button */}
                <button
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Add More Tile */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-rose-200 bg-slate-50/50 hover:bg-rose-50/20 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors"
            >
              <Plus className="h-6 w-6 text-primary mb-1" />
              <span className="text-xs font-bold text-primary">Add More</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-lg z-30">
        <div className="max-w-lg mx-auto grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            className="h-12 rounded-2xl text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="h-12 rounded-2xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md"
          >
            Submit Media
          </Button>
        </div>
      </div>
    </div>
  )
}

export default UploadReviewPhotosPage
