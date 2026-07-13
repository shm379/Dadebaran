// Zibal payment gateway (https://zibal.ir) IPG client.
//
// Flow: request() -> redirect the user to payUrl -> Zibal redirects back to our
// callbackUrl -> verify(trackId) confirms the payment server-side.
//
// Amounts are in RIAL (our plan prices are in Toman, so multiply by 10 before
// calling here). ZIBAL_MERCHANT defaults to the "zibal" sandbox merchant, which
// works against the real gateway for testing. ZIBAL_BASE_URL can override the
// endpoint (e.g. for a local mock in tests).

const BASE = (process.env.ZIBAL_BASE_URL || 'https://gateway.zibal.ir').replace(/\/+$/, '')

function merchant() {
  return process.env.ZIBAL_MERCHANT || 'zibal'
}

/**
 * @param {{amount:number, orderId:string|number, description?:string, mobile?:string, callbackUrl:string}} opts
 * @returns {Promise<{trackId:string, payUrl:string}>}
 */
export async function requestPayment({ amount, orderId, description, mobile, callbackUrl }) {
  const res = await fetch(`${BASE}/v1/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      merchant: merchant(),
      amount, // Rial
      orderId: String(orderId),
      description: description || 'Subscription',
      mobile: mobile || undefined,
      callbackUrl,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (data.result !== 100) {
    throw new Error(`zibal-request-${data.result}: ${data.message || 'failed'}`)
  }
  return { trackId: String(data.trackId), payUrl: `${BASE}/start/${data.trackId}` }
}

/**
 * @param {string} trackId
 * @returns {Promise<{paid:boolean, amount?:number, refNumber?:string, status?:number, result?:number}>}
 */
export async function verifyPayment(trackId) {
  const res = await fetch(`${BASE}/v1/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ merchant: merchant(), trackId }),
  })
  const data = await res.json().catch(() => ({}))
  // 100 = verified now, 201 = already verified. Both mean the money was paid.
  const paid = data.result === 100 || data.result === 201
  return { paid, amount: data.amount, refNumber: data.refNumber, status: data.status, result: data.result }
}
