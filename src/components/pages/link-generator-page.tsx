'use client'

/**
 * Campaign Deep Link Generator (audit unit 28 — Task 173).
 *
 * The old page seeded TWO fabricated defaults — a product id that did not
 * exist and a campaign slug that was never created — then generated tracked
 * URLs pointing at those phantoms. A marketer copying the "example" would
 * ship a broken deep link to a real campaign.
 *
 * This rebuild wires every destination to its REAL list rail — the same rails
 * the storefront, deals page, live page, and RFQ inbox read from — so the
 * picker only ever offers entities that actually resolve. The Entity ID field
 * auto-fills from the selected row (and stays editable for manual entry), the
 * campaign field is empty by default with an honest example placeholder, and
 * the new "Open this link" button actually navigates the SPA to the resolved
 * page so the marketer can verify the link works before copying it.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Link2, ArrowLeft, Copy, Check, ExternalLink, Loader2, Search, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNavigationStore } from '@/store/navigation-store'
import { toast } from 'sonner'

type DestinationId =
  | 'product-detail'
  | 'supplier-storefront'
  | 'exclusive-deal-detail'
  | 'live-shopping-detail'
  | 'rfq-list'

interface EntityOption {
  id: string
  label: string
  sub: string
}

const DESTINATIONS: Array<{ id: DestinationId; label: string; needsEntity: boolean; hint: string }> = [
  { id: 'product-detail', label: 'Product Detail Page', needsEntity: true, hint: 'A specific approved product.' },
  { id: 'supplier-storefront', label: 'Supplier Factory Storefront', needsEntity: true, hint: 'A verified supplier\'s store.' },
  { id: 'exclusive-deal-detail', label: 'Exclusive Wholesale Deal', needsEntity: true, hint: 'An active deal on a product.' },
  { id: 'live-shopping-detail', label: 'Live Factory Stream', needsEntity: true, hint: 'A scheduled or live broadcast.' },
  { id: 'rfq-list', label: 'Instant RFQ Request', needsEntity: false, hint: 'The buyer\'s RFQ inbox — no entity id needed.' },
]

const SCHEME_MAP: Record<DestinationId, string> = {
  'product-detail': 'product',
  'supplier-storefront': 'store',
  'exclusive-deal-detail': 'deal',
  'live-shopping-detail': 'live',
  'rfq-list': 'rfq',
}

const NAV_TARGET: Record<DestinationId, string> = {
  'product-detail': 'product-detail',
  'supplier-storefront': 'supplier-storefront',
  'exclusive-deal-detail': 'exclusive-deal-detail',
  'live-shopping-detail': 'live-shopping-detail',
  'rfq-list': 'customer-rfq-inbox',
}

export function LinkGeneratorPage() {
  const { navigate, goBack } = useNavigationStore()
  const [destination, setDestination] = useState<DestinationId>('product-detail')
  const [paramId, setParamId] = useState('')
  const [campaign, setCampaign] = useState('')
  const [copied, setCopied] = useState<'web' | 'app' | null>(null)
  const [options, setOptions] = useState<EntityOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [query, setQuery] = useState('')

  const destCfg = useMemo(() => DESTINATIONS.find((d) => d.id === destination)!, [destination])

  // Pull REAL entities for the chosen destination. The picker only ever
  // offers rows that actually resolve — no fabricated ids.
  useEffect(() => {
    if (!destCfg.needsEntity) {
      setOptions([])
      setOptionsError('')
      return
    }
    let alive = true
    setOptionsLoading(true)
    setOptionsError('')
    setOptions([])
    const controller = new AbortController()
    const run = async () => {
      try {
        let rows: EntityOption[] = []
        if (destination === 'product-detail') {
          const res = await fetch('/api/products?limit=50', { signal: controller.signal })
          const json = await res.json().catch(() => null)
          const list: any[] = json?.data?.products ?? json?.data ?? []
          rows = list.map((p) => ({ id: p.id, label: p.name, sub: `৳${p.basePrice} · MOQ ${p.moq}` }))
        } else if (destination === 'supplier-storefront') {
          const res = await fetch('/api/suppliers?limit=50', { signal: controller.signal })
          const json = await res.json().catch(() => null)
          const list: any[] = json?.data?.suppliers ?? json?.data ?? []
          rows = list
            .filter((s) => s.verificationStatus === 'approved' || s.verificationStatus === 'verified')
            .map((s) => ({ id: s.id, label: s.companyName, sub: s.verificationStatus ?? 'approved' }))
        } else if (destination === 'exclusive-deal-detail') {
          const res = await fetch('/api/deals?limit=50', { signal: controller.signal })
          const json = await res.json().catch(() => null)
          const list: any[] = json?.data?.deals ?? json?.data ?? []
          rows = list
            .filter((d) => d.isActive)
            .map((d) => ({ id: d.id, label: d.product?.name ?? d.id, sub: `৳${d.dealPrice} · -${d.discountPercent}%` }))
        } else if (destination === 'live-shopping-detail') {
          const res = await fetch('/api/live-shopping?limit=50', { signal: controller.signal })
          const json = await res.json().catch(() => null)
          const list: any[] = json?.data?.streams ?? json?.data ?? []
          rows = list.map((s) => ({
            id: s.id,
            label: s.title || `Stream ${s.id.slice(-6)}`,
            sub: s.isLive ? 'LIVE now' : s.scheduledAt ? `Scheduled ${new Date(s.scheduledAt).toLocaleString()}` : 'Scheduled',
          }))
        }
        if (!alive) return
        setOptions(rows)
        if (rows.length > 0 && !paramId) {
          setParamId(rows[0].id)
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return
        if (alive) setOptionsError('Could not reach the listings service.')
      } finally {
        if (alive) setOptionsLoading(false)
      }
    }
    run()
    return () => {
      alive = false
      controller.abort()
    }
  }, [destination])

  // Reset the entity id when switching destination families.
  useEffect(() => {
    setParamId('')
  }, [destination])

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
  }, [options, query])

  const selectedOption = useMemo(
    () => options.find((o) => o.id === paramId) ?? null,
    [options, paramId]
  )

  const cleanCampaign = campaign.trim()
  const schemePath = SCHEME_MAP[destination]
  const campaignQuery = cleanCampaign ? `?utm_campaign=${encodeURIComponent(cleanCampaign)}` : ''
  // For list-type destinations (rfq-list) there is no entity id — the URL is
  // just the scheme root. For entity destinations, the id segment is required.
  const entityIdSegment = destCfg.needsEntity ? `/${paramId || '{entityId}'}` : ''
  const generatedCustomUrl = `zylod://${schemePath}${entityIdSegment}${campaignQuery}`
  const generatedWebUrl = `https://zylod.com/dl/${schemePath}${entityIdSegment}${cleanCampaign ? `?utm_source=app_link&utm_campaign=${encodeURIComponent(cleanCampaign)}` : ''}`

  const hasPlaceholder = generatedCustomUrl.includes('{entityId}')
  const canOpen = !hasPlaceholder

  const copyUrl = (url: string, which: 'web' | 'app') => {
    if (hasPlaceholder) {
      toast.error('Pick a real entity first — the link still has a placeholder.')
      return
    }
    navigator.clipboard.writeText(url)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  const openLink = () => {
    if (hasPlaceholder) {
      toast.error('Pick a real entity first.')
      return
    }
    const params: Record<string, string> = {}
    if (paramId) params.id = paramId
    if (cleanCampaign) params.utm_campaign = cleanCampaign
    navigate(NAV_TARGET[destination], params)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition" aria-label="Back">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-bold text-gray-900 text-base">Deep Link Generator</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 md:py-8 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => navigate('deep-link-handler')} className="hidden md:flex gap-2 text-xs font-semibold -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to Deep Link Engine
        </Button>

        <div className="border-b pb-3">
          <h1 className="text-xl md:text-2xl font-black text-foreground">Campaign Deep Link Generator</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate tracked Universal Links and custom scheme URLs from REAL entities on the platform.
          </p>
        </div>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Link Configuration
            </CardTitle>
            <CardDescription className="text-xs">
              Pick a real target — the entity id auto-fills. The campaign tag is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Target Destination</Label>
              <Select value={destination} onValueChange={(v) => setDestination(v as DestinationId)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Choose page" />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{destCfg.hint}</p>
            </div>

            {destCfg.needsEntity && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">Pick a real {destCfg.label.toLowerCase()}</Label>
                {optionsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-xl border">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading live {destCfg.label.toLowerCase()}s…
                  </div>
                ) : optionsError ? (
                  <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{optionsError}</span>
                  </div>
                ) : options.length === 0 ? (
                  <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>No {destCfg.label.toLowerCase()}s exist on the platform yet. Create one first — the generator will not invent an id.</span>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={`Search ${options.length} ${destCfg.label.toLowerCase()}s…`}
                        className="text-xs pl-9"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
                      {filteredOptions.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground text-center">No matches.</div>
                      ) : (
                        filteredOptions.slice(0, 30).map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setParamId(o.id)}
                            className={`w-full text-left p-3 hover:bg-primary/5 transition flex items-center justify-between gap-2 ${
                              paramId === o.id ? 'bg-primary/5' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">{o.label}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{o.sub}</p>
                            </div>
                            {paramId === o.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold">Entity ID {destCfg.needsEntity && '(auto-filled — editable)'}</Label>
              <Input
                value={paramId}
                onChange={(e) => setParamId(e.target.value)}
                placeholder={destCfg.needsEntity ? 'Pick an entity above, or paste a known id' : 'No entity required for this destination'}
                disabled={!destCfg.needsEntity}
                className="text-xs font-mono"
              />
              {selectedOption && (
                <p className="text-[11px] text-emerald-700">
                  Linked to: <span className="font-bold">{selectedOption.label}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">UTM Campaign Tag (optional)</Label>
              <Input
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="e.g. eid_2026_launch"
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank for an untagged link. Use letters, numbers, underscores.
              </p>
            </div>

            {/* Result Box */}
            <div className="pt-4 border-t space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground">Universal Web App Link (HTTPS):</span>
                <div className="p-3 bg-muted/30 rounded-xl border font-mono text-xs break-all flex items-center justify-between gap-2">
                  <span className="text-primary">{generatedWebUrl}</span>
                  <Button size="sm" variant="ghost" onClick={() => copyUrl(generatedWebUrl, 'web')} className="h-7 shrink-0 text-xs">
                    {copied === 'web' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground">Native Android Scheme (ZYLOD://):</span>
                <div className="p-3 bg-muted/30 rounded-xl border font-mono text-xs break-all flex items-center justify-between gap-2">
                  <span className="text-foreground">{generatedCustomUrl}</span>
                  <Button size="sm" variant="ghost" onClick={() => copyUrl(generatedCustomUrl, 'app')} className="h-7 shrink-0 text-xs">
                    {copied === 'app' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <Button
                onClick={openLink}
                disabled={!canOpen}
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold py-3 gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {canOpen ? 'Open this link in the app' : 'Pick an entity to enable Open'}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Opens the destination right here so you can verify the link resolves before copying.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
export default LinkGeneratorPage
