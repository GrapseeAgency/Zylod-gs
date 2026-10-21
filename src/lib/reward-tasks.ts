import { z } from 'zod'
import { db } from '@/lib/db'

/**
 * Task 111: THE REWARD TASKS RAIL (shared contracts).
 *
 * couponEarningTasks has been READ by /api/coupons/earn since day one with
 * zero writers — and worse, the old POST awarded a money voucher to anyone
 * who merely POSTed a taskId: no proof, no one-claim guard, no rate limit.
 * A task is money, so its completion is PROVEN from real platform rows
 * (orders, reviews, wishlists, check-ins, spins) — never self-declared.
 *
 * The console may therefore only mint tasks whose completion the server can
 * actually verify. Types with no proof source in this schema (share,
 * referral, review_photo) are refused at create time with a message naming
 * the reason — the console cannot fabricate a promise the server cannot keep.
 */

export const REWARD_TASK_TYPES = [
  'first_order',
  'review',
  'wishlist',
  'bulk',
  'milestone',
  'spin',
  'checkin',
] as const

export type RewardTaskType = (typeof REWARD_TASK_TYPES)[number]

/** What the server counts, per type — the honest contract shown in the console. */
export const REWARD_TASK_RULES: Record<RewardTaskType, string> = {
  first_order: 'Buyer has placed at least 1 order (cancelled/returned orders never count)',
  review: 'Buyer has written at least 1 verified-purchase supplier review',
  wishlist: 'Buyer has wishlisted at least 1 product',
  bulk: 'Buyer has a single order line with quantity ≥ target',
  milestone: 'Buyer has placed at least `target` orders (cancelled/returned never count)',
  spin: 'Buyer has landed at least 1 winning spin (not "try again")',
  checkin: 'Buyer has at least `target` daily check-ins',
}

const typeRefusal = `Unknown task type. Reward tasks must be server-verifiable — allowed: ${REWARD_TASK_TYPES.join(', ')}. (share / referral / review_photo are refused: the platform has no proof source for them, so a reward on them would be a money printer.)`

export const rewardTaskSchema = z
  .object({
    type: z.enum(REWARD_TASK_TYPES, { message: typeRefusal }),
    title: z.string().min(1, 'title is required').max(120, 'title must be ≤ 120 chars'),
    description: z.string().min(1, 'description is required').max(500, 'description must be ≤ 500 chars'),
    rewardLabel: z.string().min(1, 'rewardLabel is required').max(40, 'rewardLabel must be ≤ 40 chars'),
    rewardBDT: z
      .number()
      .min(0, 'rewardBDT cannot be negative')
      .max(10000, 'rewardBDT is capped at ৳10000 — larger rewards need the coupon ledger, not a task'),
    iconColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'iconColor must be a 6-digit hex color like #C8102E')
      .optional()
      .default('#C8102E'),
    targetCount: z
      .number()
      .int('targetCount must be a whole number')
      .min(1, 'targetCount must be at least 1')
      .max(1000, 'targetCount is capped at 1000')
      .optional()
      .default(1),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.number().int('sortOrder must be a whole number').min(0, 'sortOrder cannot be negative').max(10000, 'sortOrder is capped at 10000').optional().default(0),
  })
  .strict()

/**
 * PATCH schema — written EXPLICITLY without defaults. Building it via
 * `.partial()` on the create schema leaked the create-time defaults through
 * (an empty PATCH re-applied targetCount 1 / sortOrder 0 / isActive true —
 * the drill caught a real row silently overwritten). The zod-v4 lesson from
 * Task 106, re-learned: patch schemas touch ONLY the keys that arrive.
 */
export const rewardTaskPatchSchema = z
  .object({
    type: z.enum(REWARD_TASK_TYPES, { message: typeRefusal }).optional(),
    title: z.string().min(1, 'title cannot be empty').max(120, 'title must be ≤ 120 chars').optional(),
    description: z.string().min(1, 'description cannot be empty').max(500, 'description must be ≤ 500 chars').optional(),
    rewardLabel: z.string().min(1, 'rewardLabel cannot be empty').max(40, 'rewardLabel must be ≤ 40 chars').optional(),
    rewardBDT: z.number().min(0, 'rewardBDT cannot be negative').max(10000, 'rewardBDT is capped at ৳10000').optional(),
    iconColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'iconColor must be a 6-digit hex color like #C8102E').optional(),
    targetCount: z.number().int('targetCount must be a whole number').min(1, 'targetCount must be at least 1').max(1000, 'targetCount is capped at 1000').optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int('sortOrder must be a whole number').min(0, 'sortOrder cannot be negative').max(10000, 'sortOrder is capped at 10000').optional(),
  })
  .strict()

export type RewardTaskRow = {
  id: string
  type: string
  title: string
  description: string
  rewardLabel: string
  rewardBDT: number
  iconColor: string
  targetCount: number
  isActive: boolean
  sortOrder: number
}

/** Count the buyer's REAL proof rows for a task. */
export async function countProof(
  buyerId: string,
  task: Pick<RewardTaskRow, 'type' | 'targetCount'>
): Promise<number> {
  switch (task.type) {
    case 'first_order':
    case 'milestone':
      // An order counts when at least one of its shipments is not
      // cancelled/returned — status lives on subOrders, not orders.
      return db.orders.count({
        where: {
          buyerId,
          subOrders: { some: { status: { notIn: ['cancelled', 'returned'] } } },
        },
      })
    case 'review':
      return db.supplierReviews.count({ where: { buyerId } })
    case 'wishlist':
      return db.wishlists.count({ where: { buyerId } })
    case 'bulk':
      // targetCount is the per-line QUANTITY THRESHOLD: the proof is the
      // buyer's largest single order line (0 when none). A line of qty 3
      // against target 2 reads 3 ≥ 2 — met.
      {
        const agg = await db.orderItems.aggregate({
          where: {
            subOrder: {
              order: { buyerId },
              status: { notIn: ['cancelled', 'returned'] },
            },
          },
          _max: { quantity: true },
        })
        return agg._max.quantity ?? 0
      }
    case 'spin':
      return db.spinWinResults.count({
        where: { userId: buyerId, prizeType: { not: 'try-again' } },
      })
    case 'checkin':
      return db.dailyCheckins.count({ where: { userId: buyerId } })
    default:
      return 0
  }
}

/** The honest 403 message a buyer reads when the proof is not there yet. */
export function progressMessage(task: Pick<RewardTaskRow, 'type' | 'targetCount'>, count: number): string {
  if (task.type === 'bulk') {
    return `This reward needs a single order line with quantity ≥ ${task.targetCount} — you have none yet`
  }
  return `This reward needs ${task.targetCount} — you have ${count} of ${task.targetCount} so far`
}
