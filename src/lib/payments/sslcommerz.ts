/**
 * SSLCommerz gateway client — the card (Visa/Mastercard/Amex) and
 * Nagad/Rocket/Upay aggregation layer for Bangladesh.
 *
 * Lifecycle implemented here:
 *   1. initSession()   — creates a checkout session → GatewayPageURL (redirect)
 *   2. validate()      — server-side order validation via validationserverAPI.
 *                        This is the ONLY signal we trust before crediting.
 *
 * Docs: https://developer.sslcommerz.com — sandbox store creds (testbox/qwerty)
 * are public; production creds are swapped via env vars only.
 */

const STORE_ID = process.env.SSLCOMMERZ_STORE_ID || 'testbox'
const STORE_PASSWORD = process.env.SSLCOMMERZ_STORE_PASSWORD || 'qwerty'
const MODE = process.env.SSLCOMMERZ_MODE || 'sandbox'

const INIT_URL = MODE === 'live'
  ? 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'
  : 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'

const VALIDATE_URL = MODE === 'live'
  ? 'https://developer.sslcommerz.com/validator/api/validationserverAPI.php'
  : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'

export const sslcommerzConfigured = Boolean(process.env.SSLCOMMERZ_STORE_ID) || MODE === 'sandbox'

export interface SslcSession {
  sessionkey: string
  gatewayPageURL: string
}

export async function initSession(params: {
  amount: number
  reference: string // tran_id — must be unique
  successUrl: string
  failUrl: string
  cancelUrl: string
  customer: { name: string; email: string; phone: string; city: string; address: string }
  productName: string
}): Promise<SslcSession> {
  const body = new URLSearchParams({
    store_id: STORE_ID,
    store_passwd: STORE_PASSWORD,
    total_amount: params.amount.toFixed(2),
    currency: 'BDT',
    tran_id: params.reference,
    success_url: params.successUrl,
    fail_url: params.failUrl,
    cancel_url: params.cancelUrl,
    shipped: 'NO',
    product_name: params.productName,
    product_category: 'Wallet',
    product_profile: 'general',
    emi_option: '0',
    payment_method: '', // let the customer pick on EasyCheckout
    cus_name: params.customer.name,
    cus_email: params.customer.email,
    cus_add1: params.customer.address,
    cus_city: params.customer.city,
    cus_country: 'Bangladesh',
    cus_phone: params.customer.phone,
    ship_name: params.customer.name,
    ship_add1: params.customer.address,
    ship_city: params.customer.city,
    ship_country: 'Bangladesh',
    shipping_method: 'NO',
  })

  const res = await fetch(INIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const json = await res.json()
  if (json.status !== 'SUCCESS' || !json.GatewayPageURL) {
    throw new Error(json.failedreason || 'SSLCommerz session init failed')
  }

  return { sessionkey: json.sessionkey, gatewayPageURL: json.GatewayPageURL }
}

export interface SslcValidation {
  status: string      // 'VALID' | 'VALIDATED' when ok
  tran_id: string
  val_id: string
  amount: string
  currency: string
  bank_tran_id: string
  card_type: string   // e.g. 'VISA', 'bKash-MFS', 'Nagad-MFS'
  tran_date: string
}

/**
 * Server-side validation — query the gateway for the authoritative result of a
 * transaction. Only a VALID/VALIDATED response credits the wallet.
 */
export async function validateTransaction(valId: string): Promise<SslcValidation | null> {
  const qs = new URLSearchParams({
    val_id: valId,
    store_id: STORE_ID,
    store_passwd: STORE_PASSWORD,
    format: 'json',
  })

  const res = await fetch(`${VALIDATE_URL}?${qs.toString()}`)
  if (!res.ok) return null

  const json = await res.json()
  if (!json.status) return null
  return json as SslcValidation
}
