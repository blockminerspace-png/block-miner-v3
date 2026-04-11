import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOfferwallMeMd5Signature,
  verifyOfferwallMeSignature
} from "../server/utils/offerwallPostbackSecurity.js";
import {
  assertZerAdsCallbackAuthorized,
  getZerAdsSecretFromEnv,
  getZerAdsProvidedSecretFromPayload,
  isStrongZerAdsSecret,
  parseIpAllowlist
} from "../server/utils/zeradsCallbackSecurity.js";

describe("offerwallPostbackSecurity", () => {
  it("buildOfferwallMeMd5Signature matches Offerwall.me formula", () => {
    const sig = buildOfferwallMeMd5Signature("42", "tx-1", "10.5", "mysecret");
    assert.equal(sig.length, 32);
    assert.match(sig, /^[a-f0-9]{32}$/);
  });

  it("verifyOfferwallMeSignature accepts valid hex (case-insensitive)", () => {
    const secret = "abc123secretkeymin16";
    const sub = "7";
    const tx = "T-99";
    const reward = "1.25";
    const expected = buildOfferwallMeMd5Signature(sub, tx, reward, secret);
    assert.equal(verifyOfferwallMeSignature(sub, tx, reward, secret, expected.toUpperCase()), true);
    assert.equal(verifyOfferwallMeSignature(sub, tx, reward, secret, "deadbeef"), false);
  });
});

describe("zeradsCallbackSecurity", () => {
  it("isStrongZerAdsSecret rejects placeholders and short values", () => {
    assert.equal(isStrongZerAdsSecret(""), false);
    assert.equal(isStrongZerAdsSecret("change_me_in_env"), false);
    assert.equal(isStrongZerAdsSecret("short"), false);
    assert.equal(isStrongZerAdsSecret("a".repeat(16)), true);
  });

  it("parseIpAllowlist splits and trims", () => {
    assert.deepEqual(parseIpAllowlist(" 1.2.3.4 , 5.6.7.8 "), ["1.2.3.4", "5.6.7.8"]);
  });

  it("getZerAdsProvidedSecretFromPayload prefers secret then pwd", () => {
    assert.equal(getZerAdsProvidedSecretFromPayload({ secret: "a", pwd: "b" }), "a");
    assert.equal(getZerAdsProvidedSecretFromPayload({ pwd: "only" }), "only");
    assert.equal(getZerAdsProvidedSecretFromPayload({}), "");
  });

  it("assertZerAdsCallbackAuthorized requires matching secret when strong", () => {
    const ok = assertZerAdsCallbackAuthorized({
      configuredSecret: "x".repeat(20),
      providedSecret: "x".repeat(20)
    });
    assert.equal(ok.ok, true);

    const bad = assertZerAdsCallbackAuthorized({
      configuredSecret: "x".repeat(20),
      providedSecret: "wrong"
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.status, 403);
  });
});

describe("getZerAdsSecretFromEnv", () => {
  it("reads ZERADS_SECRET_KEY or ZERADS_CALLBACK_PASSWORD", () => {
    const originalSk = process.env.ZERADS_SECRET_KEY;
    const originalCb = process.env.ZERADS_CALLBACK_PASSWORD;
    try {
      delete process.env.ZERADS_SECRET_KEY;
      process.env.ZERADS_CALLBACK_PASSWORD = "from_callback_password_env";
      assert.equal(getZerAdsSecretFromEnv(), "from_callback_password_env");
      process.env.ZERADS_SECRET_KEY = "from_secret_key";
      assert.equal(getZerAdsSecretFromEnv(), "from_secret_key");
    } finally {
      if (originalSk !== undefined) process.env.ZERADS_SECRET_KEY = originalSk;
      else delete process.env.ZERADS_SECRET_KEY;
      if (originalCb !== undefined) process.env.ZERADS_CALLBACK_PASSWORD = originalCb;
      else delete process.env.ZERADS_CALLBACK_PASSWORD;
    }
  });
});
