import crypto from "crypto";

/** Aligns with ZerAds ~5 minute aggregation windows for burst deduplication. */
export const ZERADS_PTC_DEDUPE_BUCKET_MS = 5 * 60 * 1000;

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: number } | { ok: false, reason: string }}
 */
export function parseZeradsAmountZer(raw) {
  const n = Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isFinite(n)) return { ok: false, reason: "invalid_amount" };
  if (n < 0) return { ok: false, reason: "negative_amount" };
  return { ok: true, value: n };
}

/**
 * @param {unknown} raw
 * @returns {number}
 */
export function parseZeradsClicks(raw) {
  if (raw == null || raw === "") return 0;
  const n = Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1_000_000, Math.floor(n));
}

/**
 * Stable string for ZER amounts from query/body.
 * @param {number} amountZer
 * @returns {string}
 */
export function normalizeZeradsAmountString(amountZer) {
  return Number(amountZer).toFixed(8);
}

/**
 * Idempotency hash: identical ZerAds bursts in the same 5-minute server bucket share one credit.
 * @param {{ externalUser: string, amountZer: number, clicks: number, at?: Date }} input
 * @returns {string} 64-char hex
 */
export function buildZeradsPtcCallbackHash(input) {
  const at = input.at instanceof Date ? input.at : new Date();
  const bucket = Math.floor(at.getTime() / ZERADS_PTC_DEDUPE_BUCKET_MS);
  const amountStr = normalizeZeradsAmountString(input.amountZer);
  const clicks = Math.max(0, Math.floor(Number(input.clicks)) || 0);
  const payload = ["zerads_ptc_v1", String(input.externalUser), amountStr, String(clicks), String(bucket)].join("\n");
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}
