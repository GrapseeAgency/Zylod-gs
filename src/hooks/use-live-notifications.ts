import { useCallback } from 'react'
import { useNotificationStore, type Notification } from '@/store/notification-store'
import { useRealtimeRoom, type RealtimeRoomMessage } from '@/hooks/use-realtime-room'

/**
 * Task 63 — live notification ingestion for the header bell (and any other
 * consumer). Subscribes the signed-in user to their private user:<id> room;
 * every 'notification:new' the platform persists is ingested into the
 * notification store immediately — the unread badge ticks up with no
 * polling loop anywhere. Idempotent by id: a row that already arrived via a
 * fetch is never double-counted.
 */
export function useLiveNotifications(userId?: string | null) {
  const ingestLive = useNotificationStore((s) => s.ingestLive)

  useRealtimeRoom(userId ? [`user:${userId}`] : [], {
    onEvent: useCallback(
      (msg: RealtimeRoomMessage) => {
        if (msg.event !== 'notification:new') return
        const data = msg.data as Partial<Notification> | null
        if (!data?.id) return
        ingestLive({
          id: data.id,
          type: data.type ?? 'system',
          title: data.title ?? '',
          message: data.message ?? '',
          timestamp: data.timestamp ?? new Date().toISOString(),
          isRead: false,
          relatedId: data.relatedId ?? null,
          relatedShipmentId: data.relatedShipmentId ?? null,
          relatedPaymentId: (data as { relatedPaymentId?: string | null }).relatedPaymentId ?? null,
          actionUrl: data.actionUrl ?? null,
          actionLabel: data.actionLabel ?? null,
          priority: data.priority ?? 'medium',
        })
      },
      [ingestLive]
    ),
  })
}
