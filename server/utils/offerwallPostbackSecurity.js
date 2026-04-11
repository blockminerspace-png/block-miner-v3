import crypto from "crypto";

/**
 * Offerwall.me S2S postback signature: MD5(subId + transId + reward + secretKey).
 * @see https://offerwall.me/docs/
 */
export function buildOfferwallMeMd5Signature(subId, transId, reward, secretKey) {
  const payload = String(subId) + String(transId) + String(reward) + String(secretKey);
  return crypto.createHash("md5").update(payload, "utf8").digest("hex");
}

/**
 * Timing-safe comparison of hex signature strings.
 * @param {string} signature
 * @param {string} secretKey
 * @param {string} subId
 * @param {string} transId
 * @param {string} reward
 * @returns {boolean}
 */
export function verifyOfferwallMeSignature(subId, transId, reward, secretKey, signature) {
  if (!secretKey || !signature) return false;
  const expected = buildOfferwallMeMd5Signature(subId, transId, reward, secretKey);
  const a = Buffer.from(String(signature).trim().toLowerCase(), "utf8");
  const b = Buffer.from(expected.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
