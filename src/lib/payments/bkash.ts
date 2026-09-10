/**
 * bKash Tokenized Checkout API client (v1.2.0-beta).
 *
 * Flow implemented here:
 *   1. grantToken()    — username/password → id_token (cached until expiry)
 *   2. createPayment() — returns paymentID + bkashURL (redirect the user there)
 *   3. executePayment()— after the user approves, capture the payment
 *   4. queryPayment()  — server-side truth for status verification
 *
 * Docs: https://developer.bka.sh — sandbox creds are public; production keys
 * come from the bKash Merchant Portal and are swapped via env vars only.
 */

const BKASH_APP_KEY = process.env.BKASH_APP_KEY || '4f6o0cjiki2rfm34kfdadl1eqq'
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET || '2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b'
const BKASH_USERNAME = process.env.BKASH_USERNAME || 'sandboxTokenizedUser02'
const BKASH_PASSWORD = process.env.BKASH_PASSWORD || 'sandboxTokenizedUser02@12345'
const BKASH_MODE = process.env.BKASH_MODE || 'sandbox'

const BASE_URL = BKASH_MODE === 'live'
  ? 'https://tokenized.pay.bka.sh/v1.2.0-beta'
  : 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'

export const bkashConfigured = Boolean(process.env.BKASH_APP_KEY) || BKASH_MODE === 'sandbox'

/** Cached grant token — bKash tokens last ~1h; refresh 5 min early. */
let tokenCache: { token: string; expiresAt: number } | null = null

async function grantToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token

  const res = await fetch(`${BASE_URL}/tokenized/checkout/token/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      username: BKASH_USERNAME,
      password: BKASH_PASSWORD,
    },
    body: JSON.stringify({ app_key: BKASH_APP_KEY, app_secret: BKASH_APP_SECRET }),
  })

  const json = await res.json()
  if (!json.id_token) {
    throw new Error(json.statusMessage || 'bKash token grant failed')
  }

  // id_token is a JWT; decode exp claim for cache expiry
  let expiresIn = 55 * 60 * 1000
  try {
    const payload = JSON.parse(Buffer.from(json.id_token.split('.')[1], 'base64').toString())
    if (payload.exp) expiresIn = (payload.exp * 1000) - Date.now() - (5 * 60 * 1000)
  } catch { /* keep default */ }

  tokenCache = { token: json.id_token, expiresAt: Date.now() + Math.max(expiresIn, 60_000) }
  return json.id_token
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: token,
    'X-App-Key': BKASH_APP_KEY,
  }
}

export interface BkashCreatedPayment {
  paymentID: string
  bkashURL: string
  merchantInvoiceNumber: string
}

export async function createPayment(params: {
  amount: number
  reference: string   // merchantInvoiceNumber — must be unique
  callbackURL: string // our server callback — must be publicly reachable
}): Promise<BkashCreatedPayment> {
  const token = await grantToken()

  const res = await fetch(`${BASE_URL}/tokenized/checkout/create`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      mode: '0011',
      payerReference: params.reference,
      callbackURL: params.callbackURL,
      amount: params.amount.toString(),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: params.reference,
    }),
  })

  const json = await res.json()
  if (!json.paymentID || !json.bkashURL) {
    throw new Error(json.statusMessage || 'bKash payment creation failed')
  }

  return {
    paymentID: json.paymentID,
    bkashURL: json.bkashURL,
    merchantInvoiceNumber: params.reference,
  }
}

export interface BkashExecutedPayment {
  paymentID: string
  trxID: string
  transactionStatus: string
  amount: string
}

/** Capture the payment after user approval. Throws if not successful. */
export async function executePayment(paymentID: string): Promise<BkashExecutedPayment> {
  const token = await grantToken()

  const res = await fetch(`${BASE_URL}/tokenized/checkout/execute`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ paymentID }),
  })

  const json = await res.json()
  if (json.transactionStatus !== 'Completed') {
    throw new Error(json.statusMessage || `bKash execute status: ${json.transactionStatus || 'unknown'}`)
  }

  return {
    paymentID: json.paymentID,
    trxID: json.trxID,
    transactionStatus: json.transactionStatus,
    amount: json.amount,
  }
}

/** Independent server-side status check — the source of truth before crediting. */
export async function queryPayment(paymentID: string): Promise<{
  transactionStatus: string
  amount: string
  trxID: string
} | null> {
  const token = await grantToken()

  const res = await fetch(`${BASE_URL}/tokenized/checkout/payment/status`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ paymentID }),
  })

  const json = await res.json()
  if (!json || !json.transactionStatus) return null
  return {
    transactionStatus: json.transactionStatus,
    amount: json.amount,
    trxID: json.trxID,
  }
}
