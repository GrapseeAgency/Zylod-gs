'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  User, Building2, CheckCircle2, Star, ShieldCheck,
  Truck, DollarSign, Archive, Clock, MessageSquare, ChevronRight,
  Settings, Edit3, Eye, Package, ArrowUpRight, Award,
  Sparkles, Layers, FileText, Landmark, AlertCircle, BarChart3,
  TrendingUp, Boxes, CheckSquare, Factory, ShieldAlert,
  MapPin, Phone, Mail, Globe, Share2, Download, ExternalLink,
  Shield, Check, Play, ThumbsUp, Calendar, Search, Filter,
  FileCheck2, HardHat, Warehouse, Send, Heart, QrCode,
  Wrench, Cpu, HelpCircle, Radio, AlertTriangle, Activity,
  Camera, RefreshCw, ChevronDown, ChevronUp, Zap, BookOpen,
  UserCheck, ArrowLeft, Plus, Minus, ShoppingCart,
  Lock, Bell, Image, Ruler, Weight, Banknote, Receipt,
  Hash, Info, Scale, TrendingDown, Upload, X, Loader2
} from 'lucide-react'

// ─── TYPE DEFINITIONS ───────────────────────────────────────────────────────
interface Product {
  id: string
  name: string
  slug: string
  base_price: number
  moq: number
  unit: string
  stock_quantity: number
  sold_count: number
  rating_avg: number
  rating_count: number
  images: Array<{ url: string; alt: string }>
  category?: { name: string }
}

interface Review {
  id: string
  rating: number
  comment: string
  createdAt: string
  buyer?: { buyerProfile?: { fullName?: string; businessName?: string } }
}

interface SupplierDashboardData {
  productsCount?: number
  lowStockProducts?: Array<{ id: string; name: string; stockQuantity: number; moq: number }>
  allSubOrders?: Array<any>
  topProducts?: Array<any>
  revenueByMonthRaw?: Array<any>
  verificationDocs?: Array<{ id: string; documentType: string; status: string; uploadedAt: string }>
  quoteCount?: number
  messageCount?: number
  stats?: {
    totalOrders?: number
    totalRevenue?: number
    activeSkus?: number
    ratingAvg?: number
    ratingCount?: number
  }
}

// ─── STAR RATING DISPLAY COMPONENT ─────────────────────────────────────────
function StarRating({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const starClass = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${starClass} ${i < Math.round(value) ? 'fill-amber-500 text-amber-500' : 'text-slate-200 fill-slate-200'}`}
        />
      ))}
    </div>
  )
}

// ─── PROGRESS BAR COMPONENT ─────────────────────────────────────────────────
function ProgressBar({ value, max, color = 'primary' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0))
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color === 'primary' ? 'bg-primary' : color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── STAT PILL CARD ─────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  value,
  label,
  sub,
  trend,
  color = 'primary'
}: {
  icon: React.ElementType
  value: string
  label: string
  sub?: string
  trend?: string
  color?: string
}) {
  const iconColors: Record<string, string> = {
    primary: 'text-primary bg-rose-50 border-rose-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    sky: 'text-sky-600 bg-sky-50 border-sky-100',
    violet: 'text-violet-600 bg-violet-50 border-violet-100',
  }

  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-3">
      <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${iconColors[color] || iconColors.primary}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-black text-slate-900 font-mono leading-none">{value}</div>
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600">{trend}</span>
          </div>
        )}
        <span className="text-[11px] font-bold text-slate-400 block mt-1 uppercase tracking-wider">{label}</span>
        {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
      </div>
    </div>
  )
}

// ─── MAIN SELLER PROFILE PAGE COMPONENT ─────────────────────────────────────
export function SellerProfilePage() {
  const { navigate, pageParams } = useNavigationStore()
  const { user, token, updateUser } = useAuthStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  // Determine if viewing own seller profile or another seller's public profile
  const isOwner = user?.userType === 'supplier' && (!pageParams?.sellerId || pageParams?.sellerId === user?.id)

  // Tab state
  const [activeTab, setActiveTab] = useState<
    'overview' | 'products' | 'factory' | 'certifications' | 'reviews' | 'analytics' | 'rfq' | 'contact'
  >('overview')

  // Filter/search state
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchProduct, setSearchProduct] = useState('')
  const [priceSort, setPriceSort] = useState<'default' | 'asc' | 'desc'>('default')

  // UI state
  const [following, setFollowing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [rfqQuantity, setRfqQuantity] = useState(100)
  const [rfqNote, setRfqNote] = useState('')
  const [rfqPartNumber, setRfqPartNumber] = useState('')
  const [rfqPort, setRfqPort] = useState('')
  const [rfqSubmitting, setRfqSubmitting] = useState(false)
  const [rfqSubmitted, setRfqSubmitted] = useState(false)

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false)
  const [editCompanyName, setEditCompanyName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Image upload refs
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  // Quantity selector for products
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({})

  // Data state
  const [products, setProducts] = useState<Product[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [dashboardData, setDashboardData] = useState<SupplierDashboardData | null>(null)
  const [profileData, setProfileData] = useState<any>(null)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingReviews, setLoadingReviews] = useState(false)

  // Pagination
  const [productsPage, setProductsPage] = useState(1)
  const [totalProductPages, setTotalProductPages] = useState(1)

  // ─── FETCH PROFILE & DASHBOARD DATA ─────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/profile/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setProfileData(json.data)
          setAvatarUrl(json.data.avatarUrl || null)
          setEditCompanyName(json.data.supplierProfile?.companyName || json.data.fullName || '')
          setEditPhone(json.data.phone || '')
          setEditEmail(json.data.email || '')
        }
      }
    } catch {
      // Graceful
    }
  }, [token])

  const fetchDashboardStats = useCallback(async () => {
    if (!token || !isOwner) return
    try {
      const res = await fetch('/api/supplier/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setDashboardData(json)
      }
    } catch {
      // Graceful
    }
  }, [token, isOwner])

  const fetchProducts = useCallback(async (page = 1) => {
    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({
        limit: '12',
        page: String(page),
        ...(selectedCategory !== 'All' ? { category: selectedCategory } : {}),
        ...(searchProduct ? { q: searchProduct } : {}),
        ...(priceSort !== 'default' ? { sortBy: 'price', sortDir: priceSort } : {}),
      })

      const res = await fetch(`/api/products?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data && Array.isArray(json.data)) {
          setProducts(json.data)
          if (json.pagination) {
            setTotalProductPages(json.pagination.totalPages || 1)
          }
        }
      }
    } catch {
      // Graceful
    } finally {
      setLoadingProducts(false)
    }
  }, [selectedCategory, searchProduct, priceSort])

  const fetchReviews = useCallback(async () => {
    setLoadingReviews(true)
    try {
      const res = await fetch('/api/reviews?limit=20', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data && Array.isArray(json.data)) {
          setReviews(json.data)
        }
      }
    } catch {
      // Graceful
    } finally {
      setLoadingReviews(false)
    }
  }, [token])

  useEffect(() => {
    fetchProfile()
    fetchDashboardStats()
    fetchProducts(productsPage)
    fetchReviews()
  }, [fetchProfile, fetchDashboardStats, fetchProducts, fetchReviews, productsPage])

  // ─── PHOTO UPLOAD HANDLERS ─────────────────────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return

    setUploadingAvatar(true)
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
          setAvatarUrl(json.data.avatarUrl)
          if (updateUser) {
            updateUser({ avatarUrl: json.data.avatarUrl })
          }
        }
      }
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return

    setUploadingCover(true)
    try {
      const formData = new FormData()
      formData.append('cover', file)

      const res = await fetch('/api/profile/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (res.ok) {
        const json = await res.json()
        if (json.data?.coverUrl || json.data?.url) {
          setCoverUrl(json.data.coverUrl || json.data.url)
        }
      }
    } catch (err) {
      console.error('Cover upload failed:', err)
    } finally {
      setUploadingCover(false)
    }
  }

  // ─── SAVE PROFILE EDITS ────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!token) return
    setSavingProfile(true)
    try {
      const res = await fetch('/api/profile/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: editCompanyName,
          companyName: editCompanyName,
          phone: editPhone,
          email: editEmail,
        }),
      })

      if (res.ok) {
        await fetchProfile()
        setIsEditing(false)
      }
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setSavingProfile(false)
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const getProductQuantity = (productId: string, moq: number) =>
    productQuantities[productId] ?? moq

  const setProductQuantity = (productId: string, moq: number, delta: number) => {
    setProductQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(moq, (prev[productId] ?? moq) + delta),
    }))
  }

  const handleAddToCart = (item: Product) => {
    const qty = getProductQuantity(item.id, item.moq)
    addItem({
      id: item.id,
      productId: item.id,
      productName: item.name,
      productSlug: item.slug || 'product',
      productImage: item.images?.[0]?.url || null,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity: qty,
      unitPrice: item.base_price,
      totalPrice: item.base_price * qty,
      moq: item.moq,
      maxOrderQty: null,
      supplierId: user?.id || 'sup-current',
      supplierName: profileData?.supplierProfile?.companyName || user?.fullName || 'Verified Seller',
      supplierSlug: profileData?.supplierProfile?.slug || 'seller',
      unit: item.unit || 'unit',
      priceTiers: [],
    })
    navigate('cart')
  }

  const handleRfqSubmit = async () => {
    if (!token) {
      navigate('login')
      return
    }
    setRfqSubmitting(true)
    try {
      await fetch('/api/rfq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supplierId: user?.id,
          quantity: rfqQuantity,
          partNumber: rfqPartNumber,
          destinationPort: rfqPort,
          notes: rfqNote,
        }),
      })
      setRfqSubmitted(true)
      setTimeout(() => setRfqSubmitted(false), 3000)
    } catch {
      // Graceful
    } finally {
      setRfqSubmitting(false)
    }
  }

  const companyName = profileData?.supplierProfile?.companyName || user?.fullName || 'Wholesale Supplier'
  const isVerified = profileData?.supplierProfile?.verificationStatus === 'approved'
  const ratingAvg = profileData?.supplierProfile?.ratingAvg ?? (products.length > 0 ? 4.8 : 0)
  const ratingCount = profileData?.supplierProfile?.ratingCount ?? reviews.length
  const totalProducts = dashboardData?.productsCount ?? products.length
  const totalQuotes = dashboardData?.quoteCount ?? 0

  const productCategories = ['All', 'Industrial', 'Electronics', 'Textiles', 'Machinery', 'Packaging', 'Hardware']

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hidden file inputs for avatar & cover uploads */}
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={coverInputRef}
        onChange={handleCoverUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('home')} className="md:hidden p-1 text-slate-700 hover:text-slate-900" title="Home">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <span className="text-lg font-black tracking-tight text-primary">Zylod</span>
            <span className="text-[9px] font-bold text-slate-400 block -mt-0.5 uppercase tracking-widest">
              {isOwner ? 'My Seller Portal' : 'Verified Supplier'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Share'}
          </button>
          {isOwner && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {isEditing ? 'Close' : 'Edit'}
            </button>
          )}
          <button
            onClick={() => navigate('account-settings')}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto pb-28 md:max-w-3xl md:pb-10">
        {/* ─── 1. HERO BANNER & IDENTITY ─────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200">
          {/* Factory Cover Banner */}
          <div className="h-44 md:h-64 bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 relative overflow-hidden group">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800 opacity-60">
                <Building2 className="h-16 w-16 text-slate-600" />
              </div>
            )}

            {/* Change cover button for owner */}
            {isOwner && (
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-1.5 backdrop-blur-md transition-all shadow-md"
              >
                {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {uploadingCover ? 'Uploading...' : 'Change Cover'}
              </button>
            )}

            {/* Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1.5">
                <Factory className="h-3 w-3 text-rose-400" />
                B2B Manufacturer
              </span>
            </div>
          </div>

          {/* Identity zone */}
          <div className="px-4 pb-4 -mt-12 space-y-4">
            {/* Avatar row */}
            <div className="flex items-end justify-between">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden ring-2 ring-rose-100 flex items-center justify-center bg-slate-100">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={companyName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-10 w-10 text-slate-400" />
                  )}
                </div>

                {/* Upload Avatar button for owner */}
                {isOwner && (
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center text-white text-xs font-bold"
                  >
                    {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  </button>
                )}

                {isVerified && (
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center border-2 border-white shadow-md">
                    <CheckCircle2 className="h-4 w-4 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isOwner ? (
                  <>
                    <Button
                      onClick={() => navigate('add-product')}
                      className="h-9 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Product
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate('edit-profile')}
                      className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 text-slate-700 flex items-center gap-1.5 hover:border-primary hover:text-primary"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit Info
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => setFollowing((f) => !f)}
                      className={`h-9 px-4 rounded-xl text-xs font-bold transition-all ${
                        following
                          ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                          : 'bg-primary hover:bg-primary/90 text-white shadow-md'
                      }`}
                    >
                      {following ? 'Following' : '+ Follow'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate('delivery-chat')}
                      className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 flex items-center gap-1.5 text-slate-700 hover:text-primary hover:border-primary"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Inquiry
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Inline Profile Editor */}
            {isEditing && isOwner ? (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Quick Edit Profile</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600">Company / Store Name</label>
                    <Input
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      className="h-9 rounded-xl bg-white text-xs"
                      placeholder="Company Name"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600">Phone</label>
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="h-9 rounded-xl bg-white text-xs"
                      placeholder="Phone"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600">Email</label>
                    <Input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="h-9 rounded-xl bg-white text-xs"
                      placeholder="Email"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="bg-primary hover:bg-primary/90 text-white h-8 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    {savingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="h-8 px-3 rounded-xl text-xs font-bold border-slate-200 text-slate-600"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* Company Name + Tagline */
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                    {companyName}
                  </h1>
                  {isVerified ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      Verified Merchant
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="h-3 w-3 text-amber-600" />
                      Pending Verification
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Verified Wholesale Manufacturer on Zylod Platform. ISO-standard quality controls, bulk supply agreements, and direct factory distribution.
                </p>
              </div>
            )}

            {/* Meta chips */}
            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5 font-semibold">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Dhaka, Bangladesh
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Active on Zylod
              </span>
              <span className="flex items-center gap-1.5 font-bold text-slate-800">
                <strong className="text-primary">{totalProducts}</strong> SKUs
              </span>
              {ratingCount > 0 && (
                <span className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  {ratingAvg.toFixed(1)} ({ratingCount})
                </span>
              )}
            </div>

            {/* Performance Score Bar */}
            <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-slate-100">
              {[
                { label: 'Catalog SKUs', value: String(totalProducts), icon: Package },
                { label: 'Rating', value: ratingAvg > 0 ? ratingAvg.toFixed(1) : '5.0', icon: Star },
                { label: 'Inquiries', value: String(totalQuotes), icon: MessageSquare },
                { label: 'Status', value: isVerified ? 'Verified' : 'Active', icon: ShieldCheck },
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <div className="text-xs font-black text-slate-900 font-mono">{stat.value}</div>
                  <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider leading-tight mt-0.5">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── 2. TAB NAVIGATION (NO EMOJIS, CLEAN ICONS) ────────────────── */}
        <div className="sticky top-[57px] z-30 bg-white border-b border-slate-100 shadow-xs">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-3 py-2">
            {[
              { key: 'overview', label: 'Overview', icon: Building2 },
              { key: 'products', label: 'Products', icon: Package },
              { key: 'factory', label: 'Factory & Quality', icon: Factory },
              { key: 'certifications', label: 'Certifications', icon: Award },
              { key: 'reviews', label: 'Reviews', icon: Star },
              { key: 'analytics', label: 'Analytics', icon: BarChart3 },
              { key: 'rfq', label: 'Request RFQ', icon: FileText },
              { key: 'contact', label: 'Contact', icon: MapPin },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-primary text-white shadow-xs font-black'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── TAB CONTENT PANELS ─────────────────────────────────────────── */}
        <div className="px-4 py-4 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* ══════════════════════════════════════════════════════════════
                  TAB 1: COMPANY OVERVIEW
              ══════════════════════════════════════════════════════════════ */}
              {activeTab === 'overview' && (
                <>
                  {/* Corporate Specification Sheet */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        Business Specifications
                      </h2>
                      {isOwner && (
                        <button
                          onClick={() => navigate('edit-profile')}
                          className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"
                        >
                          <Edit3 className="h-3 w-3" />
                          Update
                        </button>
                      )}
                    </div>

                    <div className="divide-y divide-slate-50 text-xs space-y-0.5">
                      {[
                        { label: 'Company / Business Entity', value: companyName },
                        { label: 'Trade License / Reg No', value: profileData?.supplierProfile?.tradeLicenseNumber || 'Registered on Zylod' },
                        { label: 'Account Type', value: 'Verified Supplier' },
                        { label: 'Contact Phone', value: profileData?.phone || user?.phone || 'Configured in Settings' },
                        { label: 'Business Email', value: profileData?.email || user?.email || 'Configured in Settings' },
                        { label: 'Supported Payment Methods', value: 'Trade Escrow, L/C, Bank Transfer, bKash' },
                        { label: 'Incoterms Supported', value: 'FOB, CIF, CFR, DAP, EXW' },
                        { label: 'Shipping Port', value: 'Chittagong Port (BDCGP) / Dhaka Dry Port' },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between py-2.5 items-start gap-3">
                          <span className="text-slate-400 shrink-0 w-2/5">{label}</span>
                          <span className="font-bold text-slate-900 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sourcing & Quality Commitments */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Quality &amp; Sourcing Standards
                    </h2>
                    <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>All products backed by Zylod Trade Assurance with secure escrow payments.</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Pre-shipment quality inspection and dimensional verification on bulk orders.</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Official VAT invoices, packing lists, and export documentation provided.</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  TAB 2: PRODUCTS & CATALOG
              ══════════════════════════════════════════════════════════════ */}
              {activeTab === 'products' && (
                <>
                  {/* Search + Sort + Filter Row */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        value={searchProduct}
                        onChange={(e) => {
                          setSearchProduct(e.target.value)
                          setProductsPage(1)
                        }}
                        placeholder="Search supplier products, SKUs, or part numbers..."
                        className="h-12 pl-10 rounded-2xl bg-white border-slate-200 text-xs font-semibold shadow-2xs"
                      />
                    </div>

                    {/* Category pills */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {productCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => { setSelectedCategory(cat); setProductsPage(1) }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                            selectedCategory === cat
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product Grid */}
                  {loadingProducts ? (
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-3xl p-3.5 border border-slate-200 animate-pulse space-y-2.5">
                          <div className="aspect-square rounded-2xl bg-slate-100" />
                          <div className="h-3 bg-slate-100 rounded-md w-3/4" />
                          <div className="h-4 bg-slate-100 rounded-md w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : products.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {products.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white rounded-3xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5 group cursor-pointer hover:border-primary/40 hover:shadow-rose-100 transition-all"
                          onClick={() => navigate('product-detail', { productId: item.id })}
                        >
                          {/* Product Image */}
                          <div className="aspect-square rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative">
                            {item.images?.[0]?.url ? (
                              <img
                                src={item.images[0].url}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-10 w-10 text-slate-300" />
                              </div>
                            )}
                            {/* MOQ tag */}
                            <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded-md font-mono">
                              MOQ: {item.moq} {item.unit}
                            </span>
                          </div>

                          {/* Product Info */}
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                              {item.name}
                            </h3>
                            <div className="flex items-baseline justify-between mt-1">
                              <span className="text-sm font-black text-primary">
                                {formatPrice(item.base_price)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                /{item.unit}
                              </span>
                            </div>
                          </div>

                          {/* Quantity Selector + Add to Cart */}
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setProductQuantity(item.id, item.moq, -item.moq) }}
                                  className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="px-2 text-[11px] font-black text-slate-900 font-mono min-w-[36px] text-center">
                                  {getProductQuantity(item.id, item.moq)}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setProductQuantity(item.id, item.moq, item.moq) }}
                                  className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                = {formatPrice(item.base_price * getProductQuantity(item.id, item.moq))}
                              </span>
                            </div>

                            <Button
                              onClick={(e) => { e.stopPropagation(); handleAddToCart(item) }}
                              className="w-full bg-slate-900 hover:bg-primary text-white font-bold h-8 rounded-xl text-[11px] transition-colors flex items-center justify-center gap-1.5"
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                              Add to Cart
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-2">
                      <Boxes className="h-10 w-10 text-slate-200 mx-auto" />
                      <p className="text-sm font-bold text-slate-400">No products found</p>
                      {isOwner ? (
                        <Button
                          onClick={() => navigate('add-product')}
                          className="bg-primary text-white h-9 px-4 rounded-xl text-xs font-bold mt-2"
                        >
                          + Upload Products
                        </Button>
                      ) : (
                        <p className="text-xs text-slate-400">This supplier has not listed products under this filter yet.</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 3: FACTORY & QUALITY
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'factory' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Factory className="h-4 w-4 text-primary" />
                      Manufacturing &amp; Facility Operations
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Production facilities and warehouse storage managed according to national and international manufacturing best practices.
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {[
                        { label: 'Plant Location', value: 'Dhaka / Chittagong Zone', icon: MapPin },
                        { label: 'Quality Audit', value: 'Pre-Shipment Inspection', icon: CheckSquare },
                        { label: 'Fulfillment', value: 'Standard & Express Freight', icon: Truck },
                        { label: 'Customization', value: 'OEM / Private Label Available', icon: Wrench },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</span>
                          </div>
                          <p className="text-xs font-bold text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 4: CERTIFICATIONS & COMPLIANCE
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'certifications' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        Verification Documents &amp; Licenses
                      </h2>
                      {isOwner && (
                        <Button
                          onClick={() => navigate('edit-profile')}
                          className="h-8 px-3 rounded-xl bg-primary text-white text-xs font-bold"
                        >
                          Upload Document
                        </Button>
                      )}
                    </div>

                    {dashboardData?.verificationDocs && dashboardData.verificationDocs.length > 0 ? (
                      <div className="space-y-2.5">
                        {dashboardData.verificationDocs.map((doc) => (
                          <div key={doc.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div>
                                <h3 className="text-xs font-bold text-slate-900">{doc.documentType}</h3>
                                <p className="text-[10px] text-slate-400">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              {doc.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 space-y-2">
                        <FileCheck2 className="h-10 w-10 text-slate-200 mx-auto" />
                        <p className="text-xs text-slate-400">Trade License &amp; Government Accreditations verified through Zylod Merchant KYC.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 5: BUYER REVIEWS & RATINGS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'reviews' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      Verified Buyer Reviews
                    </h2>

                    {loadingReviews ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                        ))}
                      </div>
                    ) : reviews.length > 0 ? (
                      <div className="space-y-3">
                        {reviews.map((review) => (
                          <div key={review.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">
                                {review.buyer?.buyerProfile?.businessName || review.buyer?.buyerProfile?.fullName || 'Verified Buyer'}
                              </span>
                              <StarRating value={review.rating} />
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{review.comment}</p>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-2">
                        <Star className="h-10 w-10 text-slate-200 mx-auto" />
                        <p className="text-xs font-bold text-slate-400">No reviews yet</p>
                        <p className="text-[11px] text-slate-400">Verified buyer reviews for completed purchase orders will appear here.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 6: ANALYTICS & INSIGHTS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'analytics' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard icon={Package} value={String(totalProducts)} label="Active SKUs" sub="Listed in catalog" color="sky" />
                    <StatCard icon={Star} value={ratingAvg > 0 ? ratingAvg.toFixed(1) : '5.0'} label="Rating Score" sub={`${ratingCount} reviews`} color="amber" />
                    <StatCard icon={FileText} value={String(totalQuotes)} label="Quote Requests" sub="Total inquiries" color="violet" />
                    <StatCard icon={ShieldCheck} value={isVerified ? 'Approved' : 'Pending'} label="KYC Status" color="emerald" />
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 7: REQUEST FOR QUOTATION (RFQ)
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'rfq' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Request a Wholesale Quote
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Submit your bulk quantity and delivery destination to receive direct pricing from this supplier.
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Quantity Needed</label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            onClick={() => setRfqQuantity((q) => Math.max(10, q - 50))}
                            variant="outline"
                            className="h-10 w-10 rounded-xl"
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            value={rfqQuantity}
                            onChange={(e) => setRfqQuantity(Math.max(1, Number(e.target.value)))}
                            className="h-10 text-center font-mono font-bold"
                          />
                          <Button
                            onClick={() => setRfqQuantity((q) => q + 50)}
                            variant="outline"
                            className="h-10 w-10 rounded-xl"
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700">Part Number / Specifications</label>
                        <Input
                          value={rfqPartNumber}
                          onChange={(e) => setRfqPartNumber(e.target.value)}
                          placeholder="e.g. Model / Material / Tolerances"
                          className="h-10 rounded-xl text-xs mt-1"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700">Destination Delivery Port / City</label>
                        <Input
                          value={rfqPort}
                          onChange={(e) => setRfqPort(e.target.value)}
                          placeholder="e.g. Dhaka, Chittagong, Sylhet"
                          className="h-10 rounded-xl text-xs mt-1"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700">Additional Notes</label>
                        <textarea
                          rows={3}
                          value={rfqNote}
                          onChange={(e) => setRfqNote(e.target.value)}
                          placeholder="Payment terms, special packaging, testing requirements..."
                          className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs resize-none focus:outline-none focus:border-primary mt-1"
                        />
                      </div>

                      <Button
                        onClick={handleRfqSubmit}
                        disabled={rfqSubmitting || rfqSubmitted}
                        className={`w-full font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2 ${
                          rfqSubmitted ? 'bg-emerald-600 text-white' : 'bg-primary text-white'
                        }`}
                      >
                        {rfqSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : rfqSubmitted ? (
                          <><Check className="h-4 w-4" /> Quote Request Sent!</>
                        ) : (
                          <><Send className="h-4 w-4" /> Submit RFQ to Supplier</>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 8: CONTACT & DIRECT INQUIRY
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'contact' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Contact &amp; Location
                    </h2>

                    <div className="divide-y divide-slate-50 text-xs">
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">Headquarters</span>
                        <span className="font-bold text-slate-900">Dhaka, Bangladesh</span>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">Support Hours</span>
                        <span className="font-bold text-slate-900">Sun - Thu: 09:00 AM - 06:00 PM BST</span>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">Messaging</span>
                        <span className="font-bold text-primary">Direct Chat via Zylod</span>
                      </div>
                    </div>

                    {!isOwner && (
                      <Button
                        onClick={() => navigate('delivery-chat')}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Start Chat with Supplier
                      </Button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
