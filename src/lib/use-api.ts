'use client'
/**
 * Lightweight data-fetching hooks with graceful fallbacks.
 * Each hook returns { data, loading, error, refresh } and falls back to []
 * or null when the API fails — so the UI never crashes on missing data.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import {
  cacheProductsForOffline,
  isNativeOfflineCapable,
  queueOfflineAction,
  syncNativeAuthToken,
} from '@/lib/native-bridge'

/**
 * Thrown when a mutation could not reach the server but was saved into the
 * native offline sync queue for automatic replay once connectivity returns.
 */
export class OfflineQueuedError extends Error {
  readonly offlineQueued = true
  constructor(message = 'You are offline. This action was saved and will sync automatically when you reconnect.') {
    super(message)
    this.name = 'OfflineQueuedError'
  }
}

/** Mutations replayed hours later make no sense for these paths. */
const OFFLINE_QUEUE_EXCLUDED = [/^\/api\/auth\//, /^\/api\/uploads\//, /^\/api\/chat\//, /^\/api\/search\//]

function shouldQueueOffline(url: string): boolean {
  return isNativeOfflineCapable() && !OFFLINE_QUEUE_EXCLUDED.some((pattern) => pattern.test(url))
}

/** Maps e.g. POST /api/orders → actionType "POST /api/orders", entityType "orders". */
function queueFailedMutation(url: string, method: string, body?: unknown): void {
  try {
    const path = new URL(url, window.location.origin).pathname
    const entityType = path.split('/')[2] || 'unknown'
    queueOfflineAction(`${method} ${path}`, entityType, { url: path, method, body })
  } catch {
    // Malformed URL — nothing sensible to queue.
  }
}

/** Auth header from the persisted Zustand store (readable outside React). */
function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token
  // Keep the native encrypted store in sync so the offline sync worker can
  // replay queued actions as this user.
  syncNativeAuthToken(token)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...authHeaders() } })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'API error')
  // Mirror product listings into the native Room offline cache (no-op on web).
  if (Array.isArray(json.data) && /^\/api\/products(\?|$)/.test(url)) {
    cacheProductsForOffline(json.data)
  }
  return json.data as T
}

/** POST/PATCH helper for mutations. Returns the API data payload or throws. */
async function mutateJson<T>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    // Network-level failure (offline / server unreachable). Queue the action
    // in the native offline sync queue instead of losing it.
    if (err instanceof TypeError && shouldQueueOffline(url)) {
      queueFailedMutation(url, method, body)
      throw new OfflineQueuedError()
    }
    throw err
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'API error')
  return json.data as T
}

export const api = {
  post: <T>(url: string, body?: unknown) => mutateJson<T>(url, 'POST', body),
  patch: <T>(url: string, body?: unknown) => mutateJson<T>(url, 'PATCH', body),
  put: <T>(url: string, body?: unknown) => mutateJson<T>(url, 'PUT', body),
  del: <T>(url: string, body?: unknown) => mutateJson<T>(url, 'DELETE', body),
}

export function useApi<T>(url: string | null, deps: unknown[] = [], opts: { pollMs?: number } = {}): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const run = useCallback(async (silent = false) => {
    if (!url) {
      setData(null)
      setLoading(false)
      return
    }
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const result = await fetchJson<T>(url)
      if (mountedRef.current) setData(result)
    } catch (e) {
      if (mountedRef.current && !silent) setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps])

  useEffect(() => {
    mountedRef.current = true
    run()
    if (opts.pollMs && opts.pollMs > 0) {
      const id = setInterval(() => run(true), opts.pollMs)
      return () => { mountedRef.current = false; clearInterval(id) }
    }
    return () => { mountedRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  return { data, loading, error, refresh: () => run() }
}

// ============================================================
// Domain-specific hooks (typed wrappers around useApi)
// ============================================================

export interface SupplierListItem {
  id: string; userId: string; companyName: string; verificationStatus: string
  ratingAvg: number; ratingCount: number; productCount: number
  city: string; district: string; createdAt: string; accountStatus: string
}
export interface SupplierListResponse {
  suppliers: SupplierListItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export function useSuppliers(params: { search?: string; category?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.category && params.category !== 'all') qs.set('category', params.category)
  qs.set('page', String(params.page || 1))
  qs.set('limit', String(params.limit || 20))
  const url = `/api/suppliers?${qs.toString()}`
  return useApi<SupplierListItem[]>(url, [params.search, params.category, params.page, params.limit])
}

export interface SupplierDetail {
  id: string; userId: string; companyName: string; tradeLicenseNumber: string | null
  verificationStatus: string; rejectionReason: string | null
  ratingAvg: number; ratingCount: number; productCount: number
  warehouseCity: string; warehouseDistrict: string
  additionalLocations: { id: string; city: string; district: string; addressLine1: string | null }[]
  createdAt: string; accountStatus: string; memberSince: string
  reviews: {
    id: string; rating: number; comment: string | null; createdAt: string
    buyer: { id: string; name: string; businessName: string | null }
  }[]
}

export function useSupplierDetail(supplierId: string | null) {
  const url = supplierId ? `/api/suppliers/${supplierId}` : null
  return useApi<SupplierDetail>(url, [supplierId])
}

export interface SupplierProduct {
  id: string; name: string; slug: string; basePrice: number; unit: string
  moq: number; stockQuantity: number; soldCount: number; ratingAvg: number; reviewCount: number
  thumbnailUrl: string | null; isCustomizable: boolean
  category: { id: string; name: string; slug: string } | null
}

export function useSupplierProducts(supplierId: string | null, limit = 12) {
  const url = supplierId ? `/api/products?supplierId=${supplierId}&limit=${limit}&sortBy=soldCount` : null
  return useApi<SupplierProduct[]>(url, [supplierId, limit])
}

export interface ChatConversation {
  id: string; otherPartyId: string; otherPartyName: string; otherPartyBusiness: string
  product: { id: string; name: string; thumbnailUrl: string | null; basePrice: number; unit: string; moq: number } | null
  lastMessage: {
    messageText: string; sentAt: string; senderId: string
    attachmentUrl: string | null; attachmentType: string | null; attachmentName: string | null
  } | null
  messageCount: number; unreadCount: number; lastMessageAt: string | null; createdAt: string
}

export function useConversations(userId: string | null, role: 'buyer' | 'supplier' = 'buyer') {
  // userId only gates whether we fetch — identity comes from the auth token
  const url = userId ? `/api/chat/conversations?role=${role}` : null
  return useApi<ChatConversation[]>(url, [userId, role])
}

export interface ChatMessage {
  id: string; senderId: string; senderName: string
  messageText: string; attachmentUrl: string | null; attachmentType: string | null; attachmentName: string | null
  replyTo: {
    id: string; senderId: string; senderName: string
    messageText: string; attachmentUrl: string | null; attachmentType: string | null
  } | null
  isRead: boolean; sentAt: string
}

export function useMessages(conversationId: string | null, userId: string | null) {
  const url = conversationId ? `/api/chat/conversations/${conversationId}/messages` : null
  return useApi<ChatMessage[]>(url, [conversationId], { pollMs: 3000 })
}

/** Send a chat message (text and/or attachment, optional reply-to). */
export function sendMessage(conversationId: string, body: {
  senderId: string
  messageText?: string
  attachmentUrl?: string
  attachmentType?: string
  attachmentName?: string
  replyToId?: string
}) {
  return api.post<unknown>(`/api/chat/conversations/${conversationId}/messages`, body)
}

/** Upload a chat attachment (image/file). Returns { url, type, name }. */
export async function uploadChatAttachment(file: File): Promise<{ url: string; type: string; name: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/chat/upload', { method: 'POST', body: formData, headers: authHeaders() })
  if (!res.ok) {
    let message = `Upload failed: ${res.status}`
    try {
      const json = await res.json()
      if (json.error) message = json.error
    } catch { /* ignore */ }
    throw new Error(message)
  }
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Upload failed')
  return json.data as { url: string; type: string; name: string }
}

/** Create or reuse a conversation between a buyer and a supplier. */
export function createConversation(buyerId: string, supplierId: string, productId?: string) {
  return api.post<{ id: string }>('/api/chat/conversations', { buyerId, supplierId, productId })
}

export interface RfqItem {
  id: string; buyerId: string; title: string; description: string
  categorySlug: string | null; quantity: number | null; unit: string
  targetPrice: number | null; deliveryCity: string | null
  deadline: string | null; status: string; createdAt: string; updatedAt: string
  items: { id: string; productName: string; specifications: string | null; quantity: number; unit: string; targetPrice: number | null }[]
  quotes: { id: string; supplierId: string; pricePerUnit: number; totalPrice: number; deliveryDays: number | null; message: string | null; status: string; createdAt: string }[]
  quoteCount: number
}

export function useRfqs(userId: string | null, role: 'buyer' | 'supplier' = 'buyer', status?: string) {
  const qs = new URLSearchParams()
  qs.set('role', role)
  if (status) qs.set('status', status)
  const url = userId ? `/api/rfq?${qs.toString()}` : null
  return useApi<RfqItem[]>(url, [userId, role, status])
}

export interface Address {
  id: string; userId: string; label: string
  addressLine1: string; addressLine2: string | null
  city: string; district: string; postalCode: string; country: string
  lat: number | null; lng: number | null; isDefault: boolean
}

export function useAddresses(userId: string | null) {
  const url = userId ? '/api/profile/addresses' : null
  return useApi<Address[]>(url, [userId])
}

// ============================================================
// Admin hooks
// ============================================================

export interface AdminUser {
  id: string; userType: string; email: string | null; phone: string | null
  accountStatus: string; createdAt: string
  isEmailVerified: boolean; isPhoneVerified: boolean
  fullName: string | null; businessName: string | null; companyName: string | null
  verificationStatus: string | null; ratingAvg: number
  orderCount: number; reviewCount: number; quoteRequestCount: number
}

export function useAdminUsers(params: { page?: number; limit?: number; role?: string; status?: string; search?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.role) qs.set('role', params.role)
  if (params.status) qs.set('status', params.status)
  if (params.search) qs.set('search', params.search)
  const url = `/api/admin/users?${qs.toString()}`
  return useApi<AdminUser[]>(url, [params.page, params.limit, params.role, params.status, params.search])
}

export interface AdminProduct {
  id: string; name: string; slug: string; basePrice: number; unit: string
  moq: number; stockQuantity: number; supplierName: string; categoryName: string
  reviewCount: number; createdAt: string
}

export function useAdminProducts(params: { page?: number; limit?: number; approved?: boolean; search?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.approved !== undefined) qs.set('approved', String(params.approved))
  if (params.search) qs.set('search', params.search)
  const url = `/api/admin/products?${qs.toString()}`
  return useApi<AdminProduct[]>(url, [params.page, params.limit, params.approved, params.search])
}

// ============================================================
// Admin mutation helpers (thin wrappers around api.*)
// ============================================================

/** Suspend / activate / ban a user account. Returns updated user. */
export function updateUserStatus(userId: string, action: 'suspend' | 'activate' | 'ban', actorId?: string, reason?: string) {
  return api.patch<unknown>('/api/admin/users', { userId, action, actorId, reason })
}

/** Approve / reject a product listing. Returns updated product. */
export function updateProductApproval(productId: string, action: 'approve' | 'reject', actorId?: string, reason?: string) {
  return api.patch<unknown>('/api/admin/products', { productId, action, actorId, reason })
}

/** Approve / reject a supplier profile (verification). */
export function verifySupplier(supplierProfileId: string, action: 'approve' | 'reject', verifiedBy: string, reason?: string) {
  return api.post<unknown>(`/api/suppliers/${supplierProfileId}/verify`, { action, verifiedBy, reason })
}

