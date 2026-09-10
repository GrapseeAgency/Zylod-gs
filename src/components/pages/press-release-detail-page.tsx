'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Calendar, User, Eye, Share2,
  ChevronRight, Newspaper, Download
} from 'lucide-react'

export function PressReleaseDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const slug = pageParams?.slug || 'zylod-secures-series-a-to-digitize-bangladesh-wholesale'
  const [release, setRelease] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/press/${slug}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) setRelease(res.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-base md:text-xl">Press Release</h1>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24 md:px-6 md:py-8 md:space-y-6 md:pb-10 lg:max-w-4xl">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-3xl" />)}
          </div>
        ) : !release ? (
          <div className="bg-white rounded-3xl p-6 text-center text-gray-400 border border-gray-100">
            Press release not found.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold uppercase">
                  {release.category?.replace('_', ' ')}
                </Badge>
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(release.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              <h2 className="text-base md:text-2xl font-black text-gray-900 leading-snug">
                {release.title}
              </h2>

              {release.imageUrl && (
                <img
                  src={release.imageUrl}
                  alt={release.title}
                  className="w-full h-48 md:h-80 rounded-2xl object-cover border border-gray-100"
                />
              )}

              <div className="text-xs md:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pt-2">
                {release.contentEn}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span>By {release.authorName || 'Zylod Press Team'}</span>
                <span>{release.views} views</span>
              </div>
            </div>

            {/* Related Releases */}
            {release.related?.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Related Releases</h3>
                {release.related.map((rel: any) => (
                  <div
                    key={rel.id}
                    onClick={() => navigate('press-release-detail', { slug: rel.slug })}
                    className="p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-blue-300 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{rel.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(rel.publishedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}

            <Button onClick={() => navigate('press-media')} className="w-full md:w-auto md:px-10 bg-slate-900 text-white rounded-xl text-xs font-bold py-3">
              Back to Newsroom
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default PressReleaseDetailPage
