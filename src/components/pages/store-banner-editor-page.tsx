'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Image as ImageIcon, Plus, Trash2, Smartphone,
  Monitor, Link as LinkIcon, Save, Check, Eye, AlertCircle
} from 'lucide-react'

interface BannerItem {
  id: string
  imageUrl: string
  title: string
  subtitle: string
  linkUrl: string
  isActive: boolean
}

export function StoreBannerEditorPage() {
  const { navigate } = useNavigationStore()

  const [banners, setBanners] = useState<BannerItem[]>([
    {
      id: '1',
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200',
      title: 'Direct Factory Wholesale Pricing',
      subtitle: 'Up to 35% Volume Discounts on Electronics & Tools',
      linkUrl: '/products?category=electronics',
      isActive: true
    }
  ])

  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('desktop')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const addBanner = () => {
    const newId = Date.now().toString()
    setBanners(prev => [
      ...prev,
      {
        id: newId,
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200',
        title: 'New Wholesale Collection',
        subtitle: 'MOQ from 50 Units • Fast Dispatch',
        linkUrl: '/products',
        isActive: true
      }
    ])
  }

  const updateBanner = (id: string, field: keyof BannerItem, value: any) => {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  const removeBanner = (id: string) => {
    setBanners(prev => prev.filter(b => b.id !== id))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/supplier/storefront', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bannerUrl: banners[0]?.imageUrl || '',
          customSections: JSON.stringify({ banners })
        })
      })
      if (res.ok) {
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Failed to save banners:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('store-customization')}
            className="md:hidden p-2 -ml-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#C8102E]" />
              Storefront Hero Banner Manager
            </h1>
            <p className="text-xs text-neutral-400">Configure promotional carousel sliders for your store</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs sm:text-sm font-semibold h-9 px-4 flex items-center gap-1.5"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Preview Control Bar */}
        <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
            <Eye className="w-4 h-4 text-[#C8102E]" />
            Live Layout Preview
          </div>
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setViewMode('mobile')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                viewMode === 'mobile' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile
            </button>
            <button
              onClick={() => setViewMode('desktop')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                viewMode === 'desktop' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
          </div>
        </div>

        {/* Live Preview Display */}
        {banners.length > 0 && (
          <div className={`mx-auto transition-all ${viewMode === 'mobile' ? 'max-w-sm' : 'w-full'}`}>
            <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 aspect-[21/9] sm:aspect-[24/9] shadow-2xl flex items-center">
              <img
                src={banners[0].imageUrl}
                alt={banners[0].title}
                className="absolute inset-0 w-full h-full object-cover brightness-50"
              />
              <div className="relative z-10 p-6 sm:p-8 space-y-2 max-w-lg">
                <Badge className="bg-[#C8102E] text-white text-[10px] uppercase font-bold">Featured Promo</Badge>
                <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight">{banners[0].title}</h2>
                <p className="text-xs sm:text-sm text-neutral-200">{banners[0].subtitle}</p>
                <Button size="sm" className="bg-white text-neutral-950 font-bold hover:bg-neutral-200 text-xs mt-2">
                  Shop Now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Banners List & Inputs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-neutral-300 uppercase tracking-wider">
              Configured Slide Banners ({banners.length})
            </h3>
            <Button
              onClick={addBanner}
              size="sm"
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Slide
            </Button>
          </div>

          <div className="space-y-4">
            {banners.map((banner, idx) => (
              <Card key={banner.id} className="bg-neutral-900 border-neutral-800">
                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <span className="text-xs font-bold text-neutral-400">Slide #{idx + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBanner(banner.id)}
                      className="text-neutral-500 hover:text-red-400 p-1.5 h-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-neutral-400 font-medium mb-1 block">Image URL</label>
                      <Input
                        value={banner.imageUrl}
                        onChange={e => updateBanner(banner.id, 'imageUrl', e.target.value)}
                        placeholder="https://..."
                        className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400 font-medium mb-1 block">Banner Title</label>
                      <Input
                        value={banner.title}
                        onChange={e => updateBanner(banner.id, 'title', e.target.value)}
                        placeholder="e.g. Factory Direct Wholesale"
                        className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400 font-medium mb-1 block">Subtitle / Promo Tagline</label>
                      <Input
                        value={banner.subtitle}
                        onChange={e => updateBanner(banner.id, 'subtitle', e.target.value)}
                        placeholder="e.g. Min. 50 pcs • 48h Dispatch"
                        className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400 font-medium mb-1 block">Target Destination Link</label>
                      <Input
                        value={banner.linkUrl}
                        onChange={e => updateBanner(banner.id, 'linkUrl', e.target.value)}
                        placeholder="/products?category=..."
                        className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StoreBannerEditorPage
