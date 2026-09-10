'use client'

import { Search, Camera, QrCode, Package, Factory, Wrench, X, Loader2, ChevronRight, Sparkles, ScanLine, FileText, Mic } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

/* ─── Suggestion types ─── */
interface Suggestion {
  type: 'product' | 'category' | 'supplier' | 'fallback'
  id: string
  name: string
  subtitle?: string
  category?: string
  price?: number
}

/* ─── Search tools ─── */
const SEARCH_TOOLS = [
  { icon: Camera, label: 'Photo Search', desc: 'Find products by image', color: '#E53935' },
  { icon: QrCode, label: 'QR Scan', desc: 'Scan product QR code', color: '#1976D2' },
  { icon: ScanLine, label: 'Barcode Scan', desc: 'Scan product barcode', color: '#388E3C' },
  { icon: Sparkles, label: 'AI Search', desc: 'Intelligent product search', color: '#6A1B9A' },
  { icon: FileText, label: 'RFQ', desc: 'Request for quotation', color: '#F57C00' },
  { icon: Mic, label: 'Voice Search', desc: 'Search by voice', color: '#00695C' },
]

/* Real destinations for each tool — no fabricated backend calls */
const TOOL_PAGE: Record<string, string> = {
  'Photo Search': 'image-search',
  'QR Scan': 'barcode-scanner',
  'Barcode Scan': 'barcode-scanner',
  'AI Search': 'search-home',
  'Voice Search': 'voice-search',
}

export function MobileSearchBar() {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  /* ─── Suggestions state ─── */
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const suggestionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  /* ─── Scan state ─── */
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false)

  /* ─── Close suggestions on outside click ─── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* ─── Fetch suggestions (debounced) ─── */
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setSuggestionsLoading(true)
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}&limit=8`)
      if (res.ok) {
        const data = await res.json()
        const result: Suggestion[] = []

        if (data.data?.fallbackSuggestions?.length > 0) {
          data.data.fallbackSuggestions.forEach((name: string, i: number) => {
            result.push({ type: 'fallback', id: `fb-${i}`, name })
          })
        }

        if (data.data?.products?.length > 0) {
          data.data.products.forEach((p: any) => {
            result.push({
              type: 'product',
              id: p.id,
              name: p.name,
              subtitle: p.category?.name,
              price: p.basePrice,
            })
          })
        }

        if (data.data?.categories?.length > 0) {
          data.data.categories.forEach((c: any) => {
            result.push({
              type: 'category',
              id: c.id,
              name: c.name,
              subtitle: c.slug,
            })
          })
        }

        if (data.data?.suppliers?.length > 0) {
          data.data.suppliers.forEach((s: any) => {
            result.push({
              type: 'supplier',
              id: s.id,
              name: s.companyName,
              subtitle: `Rating: ${s.ratingAvg?.toFixed(1) || 'N/A'}`,
            })
          })
        }

        // No results from API — show empty state
        if (result.length === 0) {
          setSuggestions([])
          setShowSuggestions(false)
          return
        }

        setSuggestions(result)
        setShowSuggestions(result.length > 0)
      }
    } catch {
      // API failed — no suggestions
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setSuggestionsLoading(false)
    }
  }, [])

  /* ─── Handle input change with debounce ─── */
  const handleInputChange = (value: string) => {
    setQuery(value)
    if (suggestionsTimerRef.current) {
      clearTimeout(suggestionsTimerRef.current)
    }
    suggestionsTimerRef.current = setTimeout(() => {
      fetchSuggestions(value)
    }, 300)
  }

  /* ─── Handle suggestion click ─── */
  const handleSuggestionClick = (suggestion: Suggestion) => {
    setShowSuggestions(false)
    setQuery('')
    if (suggestion.type === 'product') {
      navigate('product-detail', { productId: suggestion.id })
    } else if (suggestion.type === 'category') {
      navigate('category-products', { categoryId: suggestion.id })
    } else if (suggestion.type === 'supplier') {
      navigate('suppliers')
    } else {
      navigate('search-results', { q: suggestion.name })
    }
  }

  /* ─── Handle form submit ─── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setShowSuggestions(false)
      navigate('search-results', { q: query.trim() })
    }
  }

  /* ─── Suggestion icon by type ─── */
  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'product': return <Package className="w-4 h-4 text-primary" />
      case 'category': return <Search className="w-4 h-4 text-blue-500" />
      case 'supplier': return <Factory className="w-4 h-4 text-green-500" />
      default: return <Search className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <section className="mt-2">
      <form onSubmit={handleSubmit}>
        <div
          className={`relative flex items-center bg-card rounded-xl border px-3 h-10 transition-all ${
            isFocused
              ? 'border-primary ring-1 ring-primary/20 shadow-sm'
              : 'border-border/60'
          }`}
        >
          <Search className={`w-4 h-4 shrink-0 transition-colors ${isFocused ? 'text-primary' : 'text-muted-foreground'}`} />
          <input
            ref={inputRef}
            className="bg-transparent border-none focus:ring-0 focus:outline-none w-full text-sm placeholder:text-muted-foreground ml-2"
            placeholder="Search products, suppliers..."
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              setIsFocused(true)
              if (suggestions.length > 0) setShowSuggestions(true)
            }}
            onBlur={() => {
              setTimeout(() => setIsFocused(false), 200)
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false) }}
              className="p-0.5 mr-1"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          {/* Camera icon for photo search */}
          <div className="flex items-center gap-1 ml-1 border-l border-border/60 pl-2">
            <button
              type="button"
              onClick={() => navigate('image-search')}
              className="p-0.5 hover:text-primary transition-colors"
              aria-label="Photo search"
            >
              <Camera className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </form>

      {/* Search tools row - quick access tools */}
      {!isFocused && (
        <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {SEARCH_TOOLS.map((tool) => {
            const IconComp = tool.icon
            return (
              <button
                key={tool.label}
                onClick={() => {
                  if (TOOL_PAGE[tool.label]) navigate(TOOL_PAGE[tool.label])
                  else if (tool.label === 'RFQ') navigate('quote-request')
                  else setToolsDrawerOpen(true)
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground active:scale-95 transition-transform flex-none"
              >
                <IconComp className="w-3 h-3" />
                {tool.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute left-4 right-4 z-50 mt-1 bg-card rounded-xl border border-border/60 shadow-lg max-h-64 overflow-y-auto"
        >
          {suggestionsLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          )}

          {!suggestionsLoading && suggestions.map((suggestion) => (
            <button
              key={`${suggestion.type}-${suggestion.id}`}
              onClick={() => handleSuggestionClick(suggestion)}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left active:bg-muted"
            >
              <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                {getSuggestionIcon(suggestion.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{suggestion.name}</p>
                {suggestion.subtitle && (
                  <p className="text-[10px] text-muted-foreground">{suggestion.subtitle}</p>
                )}
              </div>
              {suggestion.price && (
                <span className="text-xs font-semibold text-primary shrink-0">{formatPrice(suggestion.price)}</span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Tools Drawer */}
      <Drawer open={toolsDrawerOpen} onOpenChange={setToolsDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Search Tools
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 grid grid-cols-3 gap-3">
            {SEARCH_TOOLS.map((tool) => {
              const IconComp = tool.icon
              return (
                <button
                  key={tool.label}
                  onClick={() => {
                    setToolsDrawerOpen(false)
                    if (TOOL_PAGE[tool.label]) navigate(TOOL_PAGE[tool.label])
                    else if (tool.label === 'RFQ') navigate('quote-request')
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 active:scale-95 transition-transform"
                >
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${tool.color}15` }}
                  >
                    <IconComp className="h-5 w-5" style={{ color: tool.color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">{tool.label}</span>
                  <span className="text-[9px] text-muted-foreground text-center leading-tight">{tool.desc}</span>
                </button>
              )
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  )
}
