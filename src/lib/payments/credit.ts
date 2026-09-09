import { db } from '@/lib/db'

/**
 * Credit a wallet for a verified gateway top-up. Idempotent — the unique
 * `reference` on walletTopups guarantees a topup can never be credited twice
 * (callback retries, IPN + redirect double-fires, etc.).
 *
 * Returns true when this call performed the credit, false when the topup was
 * already credited or doesn't exist.
 */
export async function creditVerifiedTopup(params: {
  reference: string
  gatewayTrxId?: string
  providerDescription: string
}): Promise<boolean> {
  const { reference, gatewayTrxId, providerDescription } = params

  return db.$transaction(async (tx) => {
    const topup = await tx.walletTopups.findUnique({ where: { reference } })
    if (!topup || topup.status === 'credited') return false

    let wallet = await tx.wallets.findFirst({ where: { userId: topup.userId } })
    if (!wallet) {
      wallet = await tx.wallets.create({ data: { userId: topup.userId, balance: 0 } })
    }

    const newBalance = wallet.balance + topup.amount
    await tx.wallets.update({ where: { id: wallet.id }, data: { balance: newBalance } })

    await tx.walletTransactions.create({
      data: {
        walletId: wallet.id,
        type: 'deposit',
        amount: topup.amount,
        balanceAfter: newBalance,
        description: providerDescription,
        relatedEntityId: gatewayTrxId || topup.reference,
      },
    })

    await tx.walletTopups.update({
      where: { reference },
      data: { status: 'credited', gatewayTrxId: gatewayTrxId || null, creditedAt: new Date() },
    })

    return true
  })
}

/** Mark a pending topup failed/cancelled (never credits). */
export async function failTopup(reference: string, status: 'failed' | 'cancelled') {
  await db.walletTopups.updateMany({
    where: { reference, status: 'pending' },
    data: { status },
  })
}
