'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { Calendar, Newspaper, ArrowRight, RefreshCw } from 'lucide-react'

interface BlogPost {
  id: string
  slug: string
  title: string
  summary: string
  category: string
  publishedAt: string
}

export function BlogPage() {
  const { navigate } = useNavigationStore()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = () => {
    setLoading(true)
    fetch('/api/blog')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) setPosts(data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-6 md:px-6 md:py-10">
        <div className="max-w-3xl mx-auto md:max-w-5xl">
          <div className="flex items-center gap-2 mb-1">
            <Newspaper className="h-5 w-5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Zylod Blog</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Insights for Wholesale Traders</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Market updates, sourcing guides, and platform news for Bangladesh's B2B wholesale community.
          </p>
        </div>
      </div>

      <main className="px-4 py-6 md:px-6 md:py-8 max-w-3xl mx-auto md:max-w-5xl w-full">
        {loading ? (
          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-5 md:space-y-0">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-100">
            <Newspaper className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No articles published yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Sourcing guides and market updates will appear here once the editorial team publishes them.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPosts}
              className="mt-4 text-xs font-semibold text-primary border-primary hover:bg-primary/5 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5 md:space-y-0">
            {posts.map(post => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate('blog-post', { slug: post.slug })}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs hover:border-primary/30 transition-colors cursor-pointer space-y-2"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-red-50 px-2 py-0.5 rounded-md">
                  {post.category}
                </span>
                <h2 className="text-sm font-bold text-slate-900 leading-snug">{post.title}</h2>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{post.summary}</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="font-semibold text-primary flex items-center gap-0.5">
                    Read <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default BlogPage
