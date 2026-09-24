'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Image as ImageIcon, Plus, Trash2, Smartphone,
  Monitor, Link as LinkIcon, Save, Check, Eye, AlertCircle, ImageOff
} from 'lucide-react'

interface BannerItem {
  id: string
  imageUrl: string
  title: string
  subtitle: string
  linkUrl: string
  isActive: boolean
}

/**
 * Storefront hero banner editor.
 *
 * Starts EMPTY — the supplier enters their own real image URL and copy.
 * Saved banners are restored from the real storefront customization API;
 * nothing is pre-filled with demo content.
 */
function sanitizeBanners(raw: unknown): BannerItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((b): b is Record<string, unknown> => typeof b === 'object' && b !== null)
    .map((b, i) => ({
      id: typeof b.id === 'string' ? b.id : `banner-${i}-${Date.now()}`,
      imageUrl: typeof b.imageUrl === 'string' ? b.imageUrl : '',
      title: typeof b.title === 'string' ? b.title : '',
      subtitle: typeof b.subtitle === 'string' ? b.subtitle : '',
      linkUrl: typeof b.linkUrl === 'string' ? b.linkUrl : '',
      isActive: typeof b.isActive === 'boolean' ? b.isActive : true,
    }))
    .filter(b => b.imageUrl.trim() !== '' || b.title.trim() !== '')
}

export function StoreBannerEditorPage() {
  const { navigate } = useNavigationStore()

  const [banners, setBanners] = useState<BannerItem[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('desktop')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [validationError, setValidationError] = useState('')

  // Restore previously saved banners from the real API (none pre-filled)
  useEffect(() => {
    let mounted = true
    const loadSaved = async () => {
      try {
        const res = await fetch('/api/supplier/storefront')
        const json = await res.json()
        if (!mounted) return
        if (res.ok && json.success && json.data) {
          let parsed: unknown = null
          try {
            parsed = json.data.storeCustomization?.customSections
              ? JSON.parse(json.data.storeCustomization.customSections)
              : null
          } catch {
            parsed = null
          }
          const restored = sanitizeBanners(
            parsed && typeof parsed === 'object' ? (parsed as { banners?: unknown }).banners : null
          )
          setBanners(restored)
        }
        // 401/404 → no store profile; editor simply starts empty
      } catch (err) {
        console.error('Failed to load saved banners:', err)
      } finally {
        if (mounted) setLoadingSaved(false)
      }
    }
    loadSaved()
    return () => { mounted = false }
  }, [])

  const addBanner = () => {
    setBanners(prev => [
      ...prev,
      { id: `banner-${Date.now()}`, imageUrl: '', title: '', subtitle: '', linkUrl: '', isActive: true }
    ])
  }

  const updateBanner = (id: string, field: keyof BannerItem, value: string) => {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  const removeBanner = (id: string) => {
    setBanners(prev => prev.filter(b => b.id !== id))
    setValidationError('')
  }

  const handleSave = useCallback(async () => {
    setSaveError('')
    setValidationError('')

    // Drop fully blank slides; a kept slide must have a title
    const kept = banners.filter(b => b.imageUrl.trim() !== '' || b.title.trim() !== '')
    const missingTitle = kept.find(b => b.title.trim() === '')
    if (missingTitle) {
      setValidationError('Every banner slide needs a title before publishing.')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/supplier/storefront', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bannerUrl: kept[0]?.imageUrl || null,
          customSections: JSON.stringify({ banners: kept })
        })
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      } else {
        // Real API error — surfaced verbatim, never masked as success
        setSaveError(json?.error || `Save failed (HTTP ${res.status})`)
      }
    } catch (err) {
      console.error('Failed to save banners:', err)
      setSaveError('Could not reach the save service. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }, [banners])

  const hero = banners[0]

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
            disabled={saving || loadingSaved}
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
        {/* Real save errors */}
        {(saveError || validationError) && (
          <div className="flex items-start gap-2 rounded-xl border border-red-900 bg-red-950/60 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs font-semibold text-red-300">{validationError || saveError}</p>
          </div>
        )}

        {/* Preview Control Bar */}
        {banners.length > 0 && (
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
        )}

        {/* Live Preview Display — neutral block when no image URL is set */}
        {hero && (
          <div className={`mx-auto transition-all ${viewMode === 'mobile' ? 'max-w-sm' : 'w-full'}`}>
            <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-gradient-to-r from-gray-800 to-gray-700 aspect-[21/9] sm:aspect-[24/9] shadow-2xl flex items-center">
              {hero.imageUrl.trim() ? (
                <img
                  src={hero.imageUrl}
                  alt={hero.title || 'Banner preview'}
                  className="absolute inset-0 w-full h-full object-cover brightness-50"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  <ImageOff className="w-8 h-8" />
                </div>
              )}
              <div className="relative z-10 p-6 sm:p-8 space-y-2 max-w-lg">
                <Badge className="bg-[#C8102E] text-white text-[10px] uppercase font-bold">Featured Promo</Badge>
                <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight">{hero.title || 'Untitled slide'}</h2>
                {hero.subtitle.trim() && (
                  <p className="text-xs sm:text-sm text-neutral-200">{hero.subtitle}</p>
                )}
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

          {banners.length === 0 ? (
            <div className="text-center py-14 border border-dashed border-neutral-800 rounded-2xl">
              <ImageIcon className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-neutral-300">No banners configured yet</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto leading-relaxed">
                Add a slide and enter your own image URL, title and promo copy. Nothing is created
                until you publish.
              </p>
            </div>
          ) : (
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
                          placeholder="https://your-cdn.example/banner.jpg"
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
                        <label className="text-xs text-neutral-400 font-medium mb-1 flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> Target Destination Link
                        </label>
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
          )}
        </div>
      </div>
    </div>
  )
}

export default StoreBannerEditorPage
