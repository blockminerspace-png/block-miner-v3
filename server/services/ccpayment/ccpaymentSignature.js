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
function timingSafeEqualHexStrings(expectedHex, receivedHex) {
  try {
    const a = Buffer.from(String(expectedHex).trim().toLowerCase(), "utf8");
    const b = Buffer.from(String(receivedHex).trim().toLowerCase(), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyCcPaymentWebhookSignature({ appId, appSecret, timestamp, rawBody, signHeader }) {
  if (!appId || !appSecret || !timestamp || rawBody === undefined || rawBody === null || !signHeader) {
    return false;
  }
  const expected = computeCcPaymentSign(appId, appSecret, timestamp, rawBody);
  return timingSafeEqualHexStrings(expected, signHeader);
}

/**
 * Webhook Sign verification: official v1 is plain SHA-256(appId+appSecret+timestamp+body).
 * Some merchant / v2 flows use the same HMAC as outbound API v2: HMAC-SHA256(appSecret, appId+timestamp+body).
 *
 * @param {{ appId: string, appSecret: string, timestamp: string, rawBody: string, signHeader: string, mode?: 'auto' | 'sha256' | 'hmac' }} params
 * @returns {boolean}
 */
export function verifyCcPaymentWebhookSignatureFlexible({
  appId,
  appSecret,
  timestamp,
  rawBody,
  signHeader,
  mode = "auto"
}) {
  if (!appId || !appSecret || !timestamp || rawBody === undefined || rawBody === null || !signHeader) {
    return false;
  }
  const m = mode === "sha256" || mode === "hmac" ? mode : "auto";

  if (m === "hmac") {
    const hmac = computeCcPaymentOutboundSignV2(appId, appSecret, timestamp, rawBody);
    return timingSafeEqualHexStrings(hmac, signHeader);
  }

  if (m === "sha256") {
    return verifyCcPaymentWebhookSignature({ appId, appSecret, timestamp, rawBody, signHeader });
  }

  if (verifyCcPaymentWebhookSignature({ appId, appSecret, timestamp, rawBody, signHeader })) {
    return true;
  }
  const hmac = computeCcPaymentOutboundSignV2(appId, appSecret, timestamp, rawBody);
  return timingSafeEqualHexStrings(hmac, signHeader);
}
