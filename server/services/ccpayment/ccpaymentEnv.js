/**
 * Centralized CCPayment feature flag parsing.
 * Production often sets APP_ID / APP_SECRET but omits CCPAYMENT_ENABLED or uses "1"/"yes".
 */

/**
 * Strip BOM, whitespace, and optional surrounding quotes from env values (common in .env files).
 *
 * @param {string | undefined} value
 * @returns {string}
 */
export function normalizeEnvString(value) {
  if (value == null) return "";
  let s = String(value);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  s = s.trim();
  if (s.length >= 2) {
    const q0 = s[0];
    const q1 = s[s.length - 1];
    if ((q0 === '"' && q1 === '"') || (q0 === "'" && q1 === "'")) {
      s = s.slice(1, -1).trim();
    }
  }
  return s;
}

/**
 * @param {string} appId
 * @param {string} appSecret
 * @returns {boolean}
 */
export function hasCcpaymentCredentials(appId, appSecret) {
  return Boolean(normalizeEnvString(appId) && normalizeEnvString(appSecret));
}

function readAppId() {
  return normalizeEnvString(process.env.CCPAYMENT_APP_ID || process.env.CCPAYMENT_API_KEY || "");
}

function readAppSecret() {
  return normalizeEnvString(
    process.env.CCPAYMENT_APP_SECRET ||
      process.env.CCPAYMENT_SECRET_KEY ||
      process.env.CCPAYMENT_WEBHOOK_SECRET ||
      ""
  );
}

/**
 * Whether wallet UI and outbound CCPayment API should run.
 *
 * - Explicit false: false, 0, no, off, disabled
 * - Explicit true: true, 1, yes, on, enabled
 * - Unset / empty: enabled when both App ID and App Secret are non-empty (credentials imply intent)
 * - Any other string: false (avoid accidental enable)
 *
 * @returns {boolean}
 */
export function isCcpaymentIntegrationEnabled() {
  const raw = normalizeEnvString(process.env.CCPAYMENT_ENABLED).toLowerCase();
  const falsy = new Set(["false", "0", "no", "off", "disabled"]);
  const truthy = new Set(["true", "1", "yes", "on", "enabled"]);
  if (falsy.has(raw)) return false;
  if (truthy.has(raw)) return true;
  if (!raw) {
    return hasCcpaymentCredentials(readAppId(), readAppSecret());
  }
  return false;
}

/**
 * For status endpoints / support (no secrets).
 *
 * @returns {{ enabled: boolean, configured: boolean, mode: 'explicit_on' | 'explicit_off' | 'inferred_from_credentials' | 'unknown_flag' }}
 */
export function getCcpaymentIntegrationStatus() {
  const raw = normalizeEnvString(process.env.CCPAYMENT_ENABLED).toLowerCase();
  const falsy = new Set(["false", "0", "no", "off", "disabled"]);
  const truthy = new Set(["true", "1", "yes", "on", "enabled"]);
  const configured = hasCcpaymentCredentials(readAppId(), readAppSecret());

  if (falsy.has(raw)) {
    return { enabled: false, configured, mode: "explicit_off" };
  }
  if (truthy.has(raw)) {
    return { enabled: true, configured, mode: "explicit_on" };
  }
  if (!raw) {
    return {
      enabled: configured,
      configured,
      mode: configured ? "inferred_from_credentials" : "unset_no_credentials"
    };
  }
  return { enabled: false, configured, mode: "unknown_flag" };
}
