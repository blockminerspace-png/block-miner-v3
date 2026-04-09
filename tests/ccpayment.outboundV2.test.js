/**
 * CCPayment outbound API v2 signing (HMAC), aligned with server/services/ccpaymentService.js.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { computeCcPaymentOutboundSignV2 } from "../server/services/ccpayment/ccpaymentSignature.js";

test("computeCcPaymentOutboundSignV2 matches HMAC-SHA256(appId+timestamp+body)", () => {
  const appId = "app1";
  const appSecret = "secret1";
  const timestamp = "1700000000";
  const rawBody = '{"a":1}';
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(`${appId}${timestamp}${rawBody}`, "utf8")
    .digest("hex");
  assert.equal(computeCcPaymentOutboundSignV2(appId, appSecret, timestamp, rawBody), expected);
});

test("computeCcPaymentOutboundSignV2 uses empty string when body omitted (GET)", () => {
  const appId = "a";
  const appSecret = "b";
  const timestamp = "1";
  const expected = crypto.createHmac("sha256", appSecret).update(`${appId}${timestamp}`, "utf8").digest("hex");
  assert.equal(computeCcPaymentOutboundSignV2(appId, appSecret, timestamp, ""), expected);
});
