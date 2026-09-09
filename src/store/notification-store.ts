import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* ─── Types ─── */

export type NotificationType = 'order-update' | 'new-message' | 'price-drop' | 'verification-status' | 'deal-alert' | 'system' | 'review' | 'promotion'

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  isRead: boolean
  actionUrl: string | null
  actionLabel: string | null
  relatedId: string | null
  priority: 'low' | 'medium' | 'high'
}

/* ─── Store ─── */

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean

  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  fetchNotifications: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      loading: false,

      markAsRead: async (notificationId) => {
        set((state) => {
          const updated = state.notifications.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
          return {
            notifications: updated,
            unreadCount: updated.filter(n => !n.isRead).length,
          }
        })
        // Fire-and-forget the API call
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notificationId }),
        }).catch(() => {})
      },

      markAllAsRead: async () => {
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, isRead: true })),
          unreadCount: 0,
        }))
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markAll: true }),
        }).catch(() => {})
      },

      fetchNotifications: async () => {
        set({ loading: true })
        try {
          const res = await fetch('/api/notifications?limit=50')
          if (res.ok) {
            const json = await res.json()
            if (json.success) {
              const mapped: Notification[] = (json.data || []).map((n: any) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                timestamp: n.timestamp,
                isRead: n.isRead,
                relatedId: n.relatedId,
                actionUrl: n.actionUrl,
                actionLabel: n.actionLabel,
                priority: n.priority || 'medium',
              }))
              set({
                notifications: mapped,
                unreadCount: json.unreadCount ?? mapped.filter(n => !n.isRead).length,
                loading: false,
              })
              return
            }
          }
        } catch {
          // silent
        }
        set({ loading: false })
      },
    }),
    {
      name: 'b2b-notification-storage',
      // Don't persist notifications (they change server-side)
      partialize: () => ({}),
    }
  )
)
