'use client'

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  Menu, User, ArrowLeft, Upload, Trash2, CheckCircle2,
  Building2, Store, Check, Camera, ShoppingBag, MessageSquare,
  ShoppingCart, Loader2
} from 'lucide-react'

export function ProfilePhotoPage() {
  const { navigate, goBack } = useNavigationStore()
  const { user, token, updateUser } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentPhoto, setCurrentPhoto] = useState<string>(
    user?.avatarUrl || ''
  )
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)

      const res = await fetch('/api/profile/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (res.ok) {
        const json = await res.json()
        if (json.data?.avatarUrl) {
          setCurrentPhoto(json.data.avatarUrl)
          if (updateUser) {
            updateUser({ avatarUrl: json.data.avatarUrl })
          }
          setSaved(true)
          setTimeout(() => setSaved(false), 2500)
        }
      }
    } catch (err) {
      console.error('Photo upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!token) return
    try {
      await fetch('/api/profile/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarUrl: null }),
      })
      setCurrentPhoto('')
      if (updateUser) {
        updateUser({ avatarUrl: null })
      }
    } catch {
      // Graceful
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={() => navigate('profile')} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        <button
          onClick={() => navigate('account-settings')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          title="Account Settings"
        >
          <User className="h-5 w-5" />
        </button>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        {/* Back Link */}
        <button
          onClick={() => navigate('profile')}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Profile</span>
        </button>

        {/* Profile Photo Management */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs text-center space-y-4">
          <h1 className="text-base md:text-2xl font-black text-slate-900">
            Profile Photo Management
          </h1>

          {/* Large Photo Preview */}
          <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-lg mx-auto overflow-hidden flex items-center justify-center">
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-12 w-12 text-slate-400" />
            )}
          </div>

          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            A clear profile photo helps build trust with buyers and suppliers on Zylod.
          </p>

          <div className="space-y-2 pt-1">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? 'Uploading Photo...' : 'Upload New Photo'}
            </Button>

            {currentPhoto && (
              <Button
                variant="outline"
                onClick={handleRemovePhoto}
                className="w-full bg-white hover:bg-rose-50 text-primary border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remove Current Photo
              </Button>
            )}
          </div>

          {saved && (
            <p className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1">
              <Check className="h-4 w-4" /> Photo updated successfully!
            </p>
          )}

          <p className="text-[10px] text-slate-400">
            Max file size: 10MB. Formats: JPG, PNG, WebP.
          </p>
        </div>
      </main>
    </div>
  )
}
