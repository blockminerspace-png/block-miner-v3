/**
 * ZerAds PTC / callback shared-secret validation.
 */

const PLACEHOLDER_SECRETS = new Set(
  ["", "change_me_in_env", "changeme", "password", "secret", "test"].map((s) => s.toLowerCase())
);

export function getZerAdsSecretFromEnv() {
  return String(process.env.ZERADS_SECRET_KEY || process.env.ZERADS_CALLBACK_PASSWORD || "").trim();
}

export function isStrongZerAdsSecret(secret) {
  const s = String(secret || "").trim();
  if (!s || s.length < 16) return false;
  if (PLACEHOLDER_SECRETS.has(s.toLowerCase())) return false;
  return true;
}

function envFlag(name) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Whether unauthenticated callbacks are explicitly allowed (local/staging only).
 * @returns {boolean}
 */
export function zeradsInsecureCallbacksAllowed() {
  if (process.env.NODE_ENV === "production") return false;
  return envFlag("ZERADS_ALLOW_INSECURE_CALLBACK");
}

/**
 * @param {{ configuredSecret: string, providedSecret: unknown }} opts
 * @returns {{ ok: true } | { ok: false, status: number, body: string }}
 */
export function assertZerAdsCallbackAuthorized(opts) {
  const { configuredSecret, providedSecret } = opts;
  const strong = isStrongZerAdsSecret(configuredSecret);

  if (strong) {
    if (String(providedSecret || "") !== configuredSecret) {
      return { ok: false, status: 403, body: "unauthorized" };
    }
    return { ok: true };
  }

  if (process.env.NODE_ENV === "production") {
    return { ok: false, status: 503, body: "callback_unconfigured" };
  }
  if (!zeradsInsecureCallbacksAllowed()) {
    return { ok: false, status: 503, body: "callback_unconfigured" };
  }
  return { ok: true };
}

/**
 * @param {string} rawList
 * @returns {string[]}
 */
export function parseIpAllowlist(rawList) {
  return String(rawList || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {import("express").Request} req
 * @param {string[]} allowedIps
 * @returns {boolean}
 */
export function isRequestIpAllowlisted(req, allowedIps) {
  if (!allowedIps.length) return true;
  const candidate = String(req.ip || "").trim();
  if (!candidate) return false;
  return allowedIps.includes(candidate);
}
