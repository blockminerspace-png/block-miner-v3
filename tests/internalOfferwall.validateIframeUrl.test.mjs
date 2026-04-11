import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateIframeUrl } from "../server/services/internalOfferwall/validateIframeUrl.js";

describe("internalOfferwall validateIframeUrl", () => {
  const hosts = new Set(["partner.example.com", "zerads.com"]);

  it("accepts https URLs on the allowlist", () => {
    const r = validateIframeUrl("https://partner.example.com/path?q=1", {
      allowHttp: false,
      allowedHosts: hosts
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.url, /^https:\/\/partner\.example\.com\//);
  });

  it("rejects http when allowHttp is false", () => {
    const r = validateIframeUrl("http://partner.example.com/", {
      allowHttp: false,
      allowedHosts: hosts
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "IFRAME_URL_SCHEME");
  });

  it("allows http when allowHttp is true", () => {
    const r = validateIframeUrl("http://partner.example.com/", {
      allowHttp: true,
      allowedHosts: hosts
    });
    assert.equal(r.ok, true);
  });

  it("rejects hosts that are not allowlisted", () => {
    const r = validateIframeUrl("https://evil.example.net/", {
      allowHttp: false,
      allowedHosts: hosts
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "IFRAME_URL_NOT_ALLOWED");
  });

  it("rejects localhost", () => {
    const r = validateIframeUrl("https://localhost/foo", {
      allowHttp: false,
      allowedHosts: new Set(["localhost"])
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "IFRAME_URL_HOST");
  });
});
