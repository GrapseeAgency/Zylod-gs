'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, FolderDown, FileText, Image as ImageIcon, Sparkles } from 'lucide-react'

interface MediaAsset {
  id: string
  assetType: string
  title: string
  description?: string
  fileUrl: string
  thumbnailUrl?: string
  fileSizeMB?: number
  fileFormat?: string
}

export function MediaKitPage() {
  const { navigate, goBack } = useNavigationStore()
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/press/media-kit')
      .then(res => res.json())
      .then(res => {
        if (res.success) setAssets(res.data.assets)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Media Kit & Brand Assets</h1>
          <p className="text-xs text-gray-400">Logos, Guidelines, Screenshots & Executive Photos</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto lg:max-w-5xl w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8">
        <div className="bg-slate-900 rounded-3xl p-5 md:p-6 text-white space-y-2">
          <div className="flex items-center gap-2">
            <FolderDown className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-sm md:text-base">Official Brand Package</h2>
          </div>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Download vector SVG logos, brand guidelines, leadership portraits, and platform screenshots for press publication.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-3xl" />)}
            </div>
          ) : (
            assets.map(asset => (
              <div key={asset.id} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  {asset.thumbnailUrl ? (
                    <img src={asset.thumbnailUrl} alt={asset.title} className="w-12 h-12 rounded-2xl object-cover border border-gray-100 flex-shrink-0" />
                  ) : (
                    <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 flex-shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs font-bold text-gray-900">{asset.title}</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">{asset.description}</p>
                    <div className="flex gap-2 pt-1">
                      <Badge variant="outline" className="text-[10px]">{asset.fileFormat}</Badge>
                      {asset.fileSizeMB && <span className="text-[10px] text-gray-400">{asset.fileSizeMB} MB</span>}
                    </div>
                  </div>
                </div>
                <a
                  href={asset.fileUrl}
                  download
                  className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition flex-shrink-0"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))
          )}
        </div>

        <Button onClick={() => navigate('press-media')} className="w-full bg-slate-900 text-white rounded-xl text-xs font-bold py-3">
          Back to Newsroom
        </Button>
      </div>
    </div>
  )
}

export default MediaKitPage
