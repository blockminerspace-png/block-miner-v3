import crypto from "crypto";

/**
 * CCPayment request/webhook signature: SHA-256 hex digest of the concatenation
 * (UTF-8): appId + appSecret + timestamp + rawJsonBody
 *
 * @see https://docs.ccpayment.com/ccpayment-v1.0-api/to-get-started/signature
 *
 * @param {string} appId
 * @param {string} appSecret
 * @param {string} timestamp String seconds (10-digit as sent in header)
 * @param {string} rawBody Exact raw JSON string (must match request bytes)
 * @returns {string} Lowercase hex SHA-256
 */
export function computeCcPaymentSign(appId, appSecret, timestamp, rawBody) {
  const payload = `${appId}${appSecret}${timestamp}${rawBody}`;
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Outbound API v2 signing (HMAC-SHA256). Used with header `Api-Version: 2`.
 * Message: UTF-8(appId + timestamp + rawBody). For GET requests, rawBody is "".
 *
 * @param {string} appId
 * @param {string} appSecret
 * @param {string} timestamp Unix seconds string
 * @param {string} rawBody Exact JSON body string, or "" if none
 * @returns {string} Lowercase hex HMAC-SHA256
 */
export function computeCcPaymentOutboundSignV2(appId, appSecret, timestamp, rawBody) {
  const msg = `${appId}${timestamp}${rawBody ?? ""}`;
  return crypto.createHmac("sha256", appSecret).update(msg, "utf8").digest("hex");
}

/**
 * Verifies the Sign header using constant-time comparison.
 *
 * @param {{ appId: string, appSecret: string, timestamp: string, rawBody: string, signHeader: string }} params
 * @returns {boolean}
 */
export function verifyCcPaymentWebhookSignature({ appId, appSecret, timestamp, rawBody, signHeader }) {
  if (!appId || !appSecret || !timestamp || rawBody === undefined || rawBody === null || !signHeader) {
    return false;
  }
  const expected = computeCcPaymentSign(appId, appSecret, timestamp, rawBody);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(String(signHeader).trim().toLowerCase(), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
