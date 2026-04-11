/**
 * @param {string} rawUrl
 * @param {{ allowHttp: boolean, allowedHosts: Set<string> }} opts
 * @returns {{ ok: true, url: string } | { ok: false, code: string, message: string }}
 */
export function validateIframeUrl(rawUrl, { allowHttp, allowedHosts }) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    return { ok: false, code: "IFRAME_URL_REQUIRED", message: "Iframe URL is required for PTC offers." };
  }
  if (trimmed.length > 2048) {
    return { ok: false, code: "IFRAME_URL_TOO_LONG", message: "Iframe URL is too long." };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: "IFRAME_URL_INVALID", message: "Iframe URL is not a valid URL." };
  }
  const proto = parsed.protocol.replace(":", "").toLowerCase();
  if (proto === "https") {
    // ok
  } else if (proto === "http" && allowHttp) {
    // ok (dev / test VM only)
  } else {
    return { ok: false, code: "IFRAME_URL_SCHEME", message: "Only https URLs are allowed for iframe content." };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost") {
    return { ok: false, code: "IFRAME_URL_HOST", message: "Invalid iframe host." };
  }
  if (!allowedHosts.has(host)) {
    return {
      ok: false,
      code: "IFRAME_URL_NOT_ALLOWED",
      message: "Iframe host is not on the allowlist. Ask an administrator to add it to INTERNAL_OFFERWALL_CSP_FRAME_HOSTS."
    };
  }
  return { ok: true, url: parsed.toString() };
}

/**
 * Builds hostname allowlist from env plus safe defaults.
 * @returns {Set<string>}
 */
export function loadIframeHostAllowlist() {
  const defaults = ["zerads.com", "www.youtube.com", "www.youtube-nocookie.com"];
  const raw = String(process.env.INTERNAL_OFFERWALL_CSP_FRAME_HOSTS || "").trim();
  const parts = raw
    ? raw
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const set = new Set([...defaults, ...parts]);
  return set;
}

export function isAllowHttpIframe() {
  const v = String(process.env.INTERNAL_OFFERWALL_ALLOW_HTTP_IFRAME || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
