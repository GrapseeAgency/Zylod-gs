'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { Calendar, Newspaper, ArrowRight, RefreshCw, ArrowLeft, ShieldAlert } from 'lucide-react'

/**
 * Task 99: THE EDITORIAL RAIL (reader). Serves exactly what the admin
 * published through /api/blog — a draft and a phantom slug are the same
 * honest 404. ?page=blog lists; ?page=blog-post&slug=… reads one.
 */

interface BlogListItem {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  coverImageUrl: string | null
  publishedAt: string
}

interface BlogFull {
  slug: string
  title: string
  content: string
  excerpt: string | null
  category: string | null
  coverImageUrl: string | null
  publishedAt: string
}

export function BlogPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const readSlug = (pageParams?.slug as string) || ''

  const [posts, setPosts] = useState<BlogListItem[]>([])
  const [loading, setLoading] = useState(!readSlug)

  // Single-post mode
  const [post, setPost] = useState<BlogFull | null>(null)
  const [postMissing, setPostMissing] = useState(false)
  const [postLoading, setPostLoading] = useState(!!readSlug)

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
    if (readSlug) {
      setPostLoading(true)
      setPostMissing(false)
      setPost(null)
      fetch(`/api/blog/${encodeURIComponent(readSlug)}`)
        .then(async res => {
          const json = await res.json().catch(() => null)
          if (res.ok && json?.success) setPost(json.data)
          else setPostMissing(true)
        })
        .catch(() => setPostMissing(true))
        .finally(() => setPostLoading(false))
    } else {
      fetchPosts()
    }
  }, [readSlug])

  /* ── single post view ── */
  if (readSlug) {
    return (
      <div className="min-h-screen bg-background pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
        <header className="bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 md:px-6 py-3 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button onClick={goBack} className="md:hidden p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800" aria-label="Go back">
              <ArrowLeft className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            </button>
            <Newspaper className="h-4 w-4 text-primary" />
            <span className="md:hidden text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Zylod Blog</span>
          </div>
        </header>

        {postLoading ? (
          <div className="px-4 py-8 max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : postMissing || !post ? (
          <div className="max-w-2xl mx-auto px-4 py-20 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-200">This article does not exist</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">The link is wrong, or the piece was unpublished.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('blog')}>All articles</Button>
          </div>
        ) : (
          <motion.article
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-6 md:py-10 max-w-2xl mx-auto w-full"
          >
            {post.category && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-red-50 px-2 py-0.5 rounded-md">
                {post.category}
              </span>
            )}
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-2 leading-tight">{post.title}</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {post.coverImageUrl && (
              <img src={post.coverImageUrl} alt={post.title} className="w-full rounded-2xl mt-5 border border-slate-100 dark:border-slate-800" />
            )}
            {post.excerpt && (
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed mt-5 border-l-2 border-primary/30 pl-3">{post.excerpt}</p>
            )}
            <div className="prose-sm mt-5 space-y-3">
              {post.content.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{para}</p>
              ))}
            </div>
          </motion.article>
        )}
      </div>
    )
  }

  /* ── list view ── */
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-6 md:px-6 md:py-10">
        <div className="max-w-3xl mx-auto md:max-w-5xl">
          <div className="flex items-center gap-2 mb-1">
            <Newspaper className="h-5 w-5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Zylod Blog</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Insights for Wholesale Traders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-2xl">
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
          <div className="text-center py-16 px-4 bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Newspaper className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No articles published yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
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
                className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xs hover:border-primary/30 transition-colors cursor-pointer space-y-2"
              >
                {post.coverImageUrl && (
                  <img src={post.coverImageUrl} alt="" className="w-full h-28 object-cover rounded-xl mb-2" />
                )}
                {post.category && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-red-50 px-2 py-0.5 rounded-md">
                    {post.category}
                  </span>
                )}
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">{post.title}</h2>
                {post.excerpt && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">{post.excerpt}</p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
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
