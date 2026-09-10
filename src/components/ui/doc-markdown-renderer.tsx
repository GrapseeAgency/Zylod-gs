'use client'

import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Copy, Check, ExternalLink, Info, AlertTriangle,
  ShieldAlert, CheckCircle2, BookOpen, Sparkles,
  ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react'

interface DocRendererProps {
  content: string
  title?: string
  lastUpdated?: string
  views?: number
  language?: 'en' | 'bn'
}

export function DocMarkdownRenderer({
  content,
  title,
  lastUpdated,
  views,
  language = 'en',
}: DocRendererProps) {
  const { navigate } = useNavigationStore()
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null)

  // Calculate reading time
  const readingTime = useMemo(() => {
    const words = content.split(/\s+/).length
    const minutes = Math.ceil(words / 180)
    return minutes <= 1 ? '1 min read' : `${minutes} min read`
  }, [content])

  // Extract table of contents headers
  const tocItems = useMemo(() => {
    const lines = content.split('\n')
    const headers: { text: string; id: string; level: number }[] = []
    lines.forEach(line => {
      const h2Match = line.match(/^##\s+(.+)$/)
      const h3Match = line.match(/^###\s+(.+)$/)
      if (h2Match) {
        const text = h2Match[1].replace(/[*_~`]/g, '').trim()
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
        headers.push({ text, id, level: 2 })
      } else if (h3Match) {
        const text = h3Match[1].replace(/[*_~`]/g, '').trim()
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
        headers.push({ text, id, level: 3 })
      }
    })
    return headers
  }, [content])

  function handleCopy(code: string, idx: number) {
    navigator.clipboard.writeText(code)
    setCopiedCodeIndex(idx)
    setTimeout(() => setCopiedCodeIndex(null), 2000)
  }

  function scrollToSection(id: string) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="relative flex gap-8 items-start">
      {/* Main Document Content */}
      <div className="flex-1 min-w-0 max-w-3xl space-y-6">
        {/* Document Header Metadata Bar */}
        {(lastUpdated || views || readingTime) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-gray-100 text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-[11px]">
                <BookOpen className="w-3.5 h-3.5 text-red-600" />
                {readingTime}
              </span>
              {views !== undefined && (
                <span className="text-gray-400">
                  {views.toLocaleString()} {language === 'bn' ? 'বার পড়া হয়েছে' : 'views'}
                </span>
              )}
            </div>
            {lastUpdated && (
              <span className="text-gray-400">
                {language === 'bn' ? 'সর্বশেষ হালনাগাদ:' : 'Last updated:'} {lastUpdated}
              </span>
            )}
          </div>
        )}

        {/* Structured React Markdown Renderer */}
        <div className="doc-content prose prose-slate max-w-none text-xs sm:text-sm text-gray-800 leading-relaxed">
          <ReactMarkdown
            components={{
              h1: ({ children }) => {
                const text = String(children)
                const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
                return (
                  <h1
                    id={id}
                    className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight pb-3 border-b border-gray-200 mt-6 mb-4 flex items-center gap-2"
                  >
                    <span className="w-2 h-6 bg-red-600 rounded-full inline-block mr-1" />
                    {children}
                  </h1>
                )
              },
              h2: ({ children }) => {
                const text = String(children)
                const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
                return (
                  <h2
                    id={id}
                    className="text-base sm:text-lg font-bold text-gray-900 tracking-tight mt-8 mb-3 pt-4 border-t border-gray-100 flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-4 bg-red-600 rounded-full inline-block" />
                    <span className="flex-1">{children}</span>
                    <a
                      href={`#${id}`}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 text-xs transition"
                      title="Link to section"
                    >
                      #
                    </a>
                  </h2>
                )
              },
              h3: ({ children }) => {
                const text = String(children)
                const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
                return (
                  <h3 id={id} className="text-sm font-bold text-gray-800 mt-5 mb-2 flex items-center gap-1.5">
                    <ChevronRight className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span>{children}</span>
                  </h3>
                )
              },
              p: ({ children }) => {
                return <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-3.5">{children}</p>
              },
              strong: ({ children }) => {
                return <strong className="font-bold text-gray-900">{children}</strong>
              },
              table: ({ children }) => {
                return (
                  <div className="my-5 overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
                    <table className="w-full text-left text-xs border-collapse divide-y divide-gray-200">
                      {children}
                    </table>
                  </div>
                )
              },
              thead: ({ children }) => {
                return <thead className="bg-slate-100/80 text-gray-900 font-bold text-[11px] uppercase tracking-wider">{children}</thead>
              },
              tbody: ({ children }) => {
                return <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>
              },
              tr: ({ children }) => {
                return <tr className="hover:bg-slate-50/70 transition-colors">{children}</tr>
              },
              th: ({ children }) => {
                return <th className="px-4 py-3 font-bold text-gray-900">{children}</th>
              },
              td: ({ children }) => {
                return <td className="px-4 py-3 text-gray-700 leading-relaxed align-top">{children}</td>
              },
              blockquote: ({ children }) => {
                const rawText = String(children)
                const isWarning = rawText.includes('WARNING') || rawText.includes('Warning') || rawText.includes('সতর্কতা')
                const isImportant = rawText.includes('IMPORTANT') || rawText.includes('Important') || rawText.includes('গুরুত্বপূর্ণ')
                const isTip = rawText.includes('TIP') || rawText.includes('Tip') || rawText.includes('পরামর্শ')

                if (isWarning) {
                  return (
                    <div className="my-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-2xl text-amber-900 text-xs space-y-1 shadow-sm">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800 uppercase tracking-wide text-[11px]">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Warning / সতর্কতা
                      </div>
                      <div className="leading-relaxed">{children}</div>
                    </div>
                  )
                }

                if (isImportant) {
                  return (
                    <div className="my-4 p-4 bg-red-50 border-l-4 border-red-600 rounded-r-2xl text-red-900 text-xs space-y-1 shadow-sm">
                      <div className="flex items-center gap-1.5 font-bold text-red-700 uppercase tracking-wide text-[11px]">
                        <ShieldAlert className="w-4 h-4 text-red-600" />
                        Crucial Requirement / আবশ্যকীয়
                      </div>
                      <div className="leading-relaxed">{children}</div>
                    </div>
                  )
                }

                if (isTip) {
                  return (
                    <div className="my-4 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-2xl text-emerald-900 text-xs space-y-1 shadow-sm">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800 uppercase tracking-wide text-[11px]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Pro Tip / পরামর্শ
                      </div>
                      <div className="leading-relaxed">{children}</div>
                    </div>
                  )
                }

                return (
                  <div className="my-4 p-4 bg-blue-50/70 border-l-4 border-blue-500 rounded-r-2xl text-blue-900 text-xs space-y-1 shadow-sm">
                    <div className="flex items-center gap-1.5 font-bold text-blue-800 uppercase tracking-wide text-[11px]">
                      <Info className="w-4 h-4 text-blue-600" />
                      Notice & Context / তথ্য
                    </div>
                    <div className="leading-relaxed">{children}</div>
                  </div>
                )
              },
              ul: ({ children }) => {
                return <ul className="my-3 space-y-2 pl-2">{children}</ul>
              },
              ol: ({ children }) => {
                return <ol className="my-3 space-y-2.5 list-decimal pl-5 text-xs text-gray-700">{children}</ol>
              },
              li: ({ children }) => {
                return (
                  <li className="text-xs sm:text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-2 flex-shrink-0" />
                    <span className="flex-1">{children}</span>
                  </li>
                )
              },
              code: ({ className, children }) => {
                const codeString = String(children).replace(/\n$/, '')
                const isBlock = className || codeString.includes('\n')

                if (isBlock) {
                  const idx = Math.random()
                  return (
                    <div className="my-4 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-md text-slate-100 text-xs font-mono">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300 uppercase tracking-wider">
                          {className?.replace('language-', '') || 'Specification Matrix'}
                        </span>
                        <button
                          onClick={() => handleCopy(codeString, 1)}
                          className="flex items-center gap-1 text-slate-400 hover:text-white transition px-2 py-0.5 rounded-md hover:bg-slate-800"
                        >
                          {copiedCodeIndex === 1 ? (
                            <>
                              <Check className="w-3 h-3 text-green-400" />
                              <span className="text-green-400 text-[10px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[10px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-4 overflow-x-auto leading-relaxed text-xs text-slate-200">
                        <code>{codeString}</code>
                      </pre>
                    </div>
                  )
                }

                return (
                  <code className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold border border-red-100">
                    {children}
                  </code>
                )
              },
              a: ({ href, children }) => {
                const isInternal = href && (href.startsWith('/') || !href.startsWith('http'))
                if (isInternal) {
                  const cleanPageId = href?.replace(/^\//, '') || ''
                  return (
                    <button
                      onClick={() => navigate(cleanPageId)}
                      className="inline-flex items-center gap-1 font-bold text-red-600 hover:text-red-700 underline underline-offset-2 transition"
                    >
                      {children}
                      <ArrowRight className="w-3 h-3 inline-block" />
                    </button>
                  )
                }
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-red-600 hover:text-red-700 font-semibold underline underline-offset-2"
                  >
                    {children}
                    <ExternalLink className="w-3 h-3 inline-block" />
                  </a>
                )
              },
              hr: () => {
                return (
                  <div className="my-8 flex items-center justify-center gap-2 text-gray-300">
                    <span className="h-px bg-gray-200 flex-1" />
                    <Sparkles className="w-3.5 h-3.5 text-red-400" />
                    <span className="h-px bg-gray-200 flex-1" />
                  </div>
                )
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>

      {/* Floating Right Sidebar: On This Page (TOC) */}
      {tocItems.length > 1 && (
        <div className="hidden lg:block w-64 sticky top-24 bg-slate-50/80 backdrop-blur border border-gray-200 rounded-2xl p-4 space-y-3 flex-shrink-0 shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            {language === 'bn' ? 'এই ডকুমেন্টে রয়েছে' : 'On this page'}
          </p>
          <nav className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
            {tocItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => scrollToSection(item.id)}
                className={`w-full text-left text-xs transition line-clamp-1 py-1 rounded-lg px-2 ${
                  item.level === 3 ? 'pl-4 text-gray-500 text-[11px]' : 'font-medium text-gray-700 hover:bg-red-50 hover:text-red-600'
                }`}
              >
                {item.text}
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}

export default DocMarkdownRenderer
