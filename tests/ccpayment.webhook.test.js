/**
 * TDD: CCPayment deposit webhook — signature verification and merchant order parsing.
 * @see https://docs.ccpayment.com/ccpayment-v1.0-api/to-get-started/signature
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  verifyCcPaymentWebhookSignature,
  verifyCcPaymentWebhookSignatureFlexible,
  computeCcPaymentSign,
  computeCcPaymentOutboundSignV2
} from "../server/services/ccpayment/ccpaymentSignature.js";
import {
  verifyCcpaymentWebhookRequest,
  unwrapCcpaymentV2WebhookPayload,
  CcpaymentWebhookError
} from "../server/services/ccpayment/ccpaymentDepositWebhookService.js";
import {
  parseUserIdFromMerchantOrderId,
  isAllowedChainAndCrypto,
  normalizePayStatus
} from "../server/services/ccpayment/ccpaymentDepositDomain.js";

test("computeCcPaymentSign matches SHA-256(appId+secret+timestamp+body)", () => {
  const appId = "202302010636261620672405236006912";
  const appSecret = "test_secret_value";
  const timestamp = "1677152490";
  const body = JSON.stringify({ pay_status: "success", order_id: "x" });
  const expected = crypto.createHash("sha256").update(`${appId}${appSecret}${timestamp}${body}`, "utf8").digest("hex");
  assert.equal(computeCcPaymentSign(appId, appSecret, timestamp, body), expected);
});

test("verifyCcPaymentWebhookSignature accepts valid sign (timing-safe)", () => {
  const appId = "aid";
  const appSecret = "sec";
  const timestamp = "1700000000";
  const body = '{"a":1}';
  const sign = computeCcPaymentSign(appId, appSecret, timestamp, body);
  assert.equal(
    verifyCcPaymentWebhookSignature({
      appId,
      appSecret,
      timestamp,
      rawBody: body,
      signHeader: sign
    }),
    true
  );
});

test("verifyCcPaymentWebhookSignature rejects wrong sign", () => {
  assert.equal(
    verifyCcPaymentWebhookSignature({
      appId: "a",
      appSecret: "b",
      timestamp: "1",
      rawBody: "{}",
      signHeader: "deadbeef"
    }),
    false
  );
});

test("verifyCcPaymentWebhookSignatureFlexible (auto) accepts v2-style HMAC sign", () => {
  const appId = "merchant_v2";
  const appSecret = "secret_v2";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = '{"type":"UserDeposit","msg":{"recordId":"r1"}}';
  const hmacSign = computeCcPaymentOutboundSignV2(appId, appSecret, timestamp, body);
  const v1Sign = computeCcPaymentSign(appId, appSecret, timestamp, body);
  assert.notEqual(hmacSign, v1Sign);
  assert.equal(
    verifyCcPaymentWebhookSignatureFlexible({
      appId,
      appSecret,
      timestamp,
      rawBody: body,
      signHeader: hmacSign,
      mode: "auto"
    }),
    true
  );
});

test("verifyCcPaymentWebhookSignatureFlexible mode=sha256 rejects HMAC-only sign", () => {
  const appId = "m";
  const appSecret = "s";
  const timestamp = "1700000000";
  const body = "{}";
  const hmacSign = computeCcPaymentOutboundSignV2(appId, appSecret, timestamp, body);
  assert.equal(
    verifyCcPaymentWebhookSignatureFlexible({
      appId,
      appSecret,
      timestamp,
      rawBody: body,
      signHeader: hmacSign,
      mode: "sha256"
    }),
    false
  );
});

test("verifyCcPaymentWebhookSignatureFlexible mode=hmac rejects v1-only sign", () => {
  const appId = "m";
  const appSecret = "s";
  const timestamp = "1700000000";
  const body = "{}";
  const v1 = computeCcPaymentSign(appId, appSecret, timestamp, body);
  assert.equal(
    verifyCcPaymentWebhookSignatureFlexible({
      appId,
      appSecret,
      timestamp,
      rawBody: body,
      signHeader: v1,
      mode: "hmac"
    }),
    false
  );
});

test("verifyCcPaymentWebhookSignature rejects tampered body", () => {
  const appId = "a";
  const appSecret = "b";
  const timestamp = "99";
  const body = '{"pay_status":"success"}';
  const sign = computeCcPaymentSign(appId, appSecret, timestamp, body);
  assert.equal(
    verifyCcPaymentWebhookSignature({
      appId,
      appSecret,
      timestamp,
      rawBody: '{"pay_status":"pending"}',
      signHeader: sign
    }),
    false
  );
});

test("parseUserIdFromMerchantOrderId supports BM{userId}-nonce", () => {
  assert.equal(parseUserIdFromMerchantOrderId("BM42-a1b2c3"), 42);
  assert.equal(parseUserIdFromMerchantOrderId("bm7-xyz"), 7);
});

test("parseUserIdFromMerchantOrderId supports stable BM{userId}-bm merchant id", () => {
  assert.equal(parseUserIdFromMerchantOrderId("BM99-bm"), 99);
});

test("parseUserIdFromMerchantOrderId supports plain numeric string", () => {
  assert.equal(parseUserIdFromMerchantOrderId("123"), 123);
});

test("parseUserIdFromMerchantOrderId returns null for invalid", () => {
  assert.equal(parseUserIdFromMerchantOrderId(null), null);
  assert.equal(parseUserIdFromMerchantOrderId("no-user-here"), null);
});

test("isAllowedChainAndCrypto accepts Polygon POL variants", () => {
  assert.equal(isAllowedChainAndCrypto("Polygon", "POL", ["Polygon", "MATIC"], ["POL", "MATIC"]), true);
  assert.equal(isAllowedChainAndCrypto("MATIC", "MATIC", ["Polygon", "MATIC"], ["POL", "MATIC"]), true);
});

test("isAllowedChainAndCrypto rejects wrong chain", () => {
  assert.equal(isAllowedChainAndCrypto("BSC", "POL", ["Polygon"], ["POL"]), false);
});

test("normalizePayStatus maps CCPayment pay_status", () => {
  assert.equal(normalizePayStatus("success"), "completed");
  assert.equal(normalizePayStatus("pending"), "pending");
  assert.equal(normalizePayStatus("processing"), "pending");
  assert.equal(normalizePayStatus("failed"), "failed");
});

test("unwrapCcpaymentV2WebhookPayload maps UserDeposit to flat API-deposit shape", () => {
  const out = unwrapCcpaymentV2WebhookPayload({
    type: "UserDeposit",
    msg: {
      recordId: "rec-1",
      userId: "BM5-bm",
      coinSymbol: "MATIC",
      status: "Success",
      amount: "1.5"
    }
  });
  assert.equal(out.pay_status, "success");
  assert.equal(out.record_id, "rec-1");
  assert.equal(out.extend.merchant_order_id, "BM5-bm");
  assert.equal(out.paid_amount, "1.5");
});

test("unwrapCcpaymentV2WebhookPayload maps DirectDeposit referenceId", () => {
  const out = unwrapCcpaymentV2WebhookPayload({
    type: "DirectDeposit",
    msg: {
      recordId: "rec-2",
      referenceId: "BM9-bm",
      coinSymbol: "POL",
      status: "Success",
      amount: "2"
    }
  });
  assert.equal(out.extend.merchant_order_id, "BM9-bm");
  assert.equal(out.paid_amount, "2");
});

test("verifyCcpaymentWebhookRequest passes for valid headers and body", () => {
  const prevId = process.env.CCPAYMENT_APP_ID;
  const prevSec = process.env.CCPAYMENT_APP_SECRET;
  process.env.CCPAYMENT_APP_ID = "merchant_app_id";
  process.env.CCPAYMENT_APP_SECRET = "merchant_secret";
  try {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '{"pay_status":"success","record_id":"1"}';
    const sign = computeCcPaymentSign("merchant_app_id", "merchant_secret", ts, body);
    verifyCcpaymentWebhookRequest(body, { appid: "merchant_app_id", timestamp: ts, sign });
  } finally {
    if (prevId === undefined) delete process.env.CCPAYMENT_APP_ID;
    else process.env.CCPAYMENT_APP_ID = prevId;
    if (prevSec === undefined) delete process.env.CCPAYMENT_APP_SECRET;
    else process.env.CCPAYMENT_APP_SECRET = prevSec;
  }
});

test("verifyCcpaymentWebhookRequest passes with HMAC (v2-style) Sign when v1 would differ", () => {
  const prevId = process.env.CCPAYMENT_APP_ID;
  const prevSec = process.env.CCPAYMENT_APP_SECRET;
  const prevMode = process.env.CCPAYMENT_WEBHOOK_SIGN_MODE;
  process.env.CCPAYMENT_APP_ID = "merchant_app_id";
  process.env.CCPAYMENT_APP_SECRET = "merchant_secret";
  delete process.env.CCPAYMENT_WEBHOOK_SIGN_MODE;
  try {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"UserDeposit","msg":{"recordId":"x","userId":"BM1-bm","status":"Success","amount":"1","coinSymbol":"POL"}}';
    const sign = computeCcPaymentOutboundSignV2("merchant_app_id", "merchant_secret", ts, body);
    verifyCcpaymentWebhookRequest(body, { appid: "merchant_app_id", timestamp: ts, sign });
  } finally {
    if (prevId === undefined) delete process.env.CCPAYMENT_APP_ID;
    else process.env.CCPAYMENT_APP_ID = prevId;
    if (prevSec === undefined) delete process.env.CCPAYMENT_APP_SECRET;
    else process.env.CCPAYMENT_APP_SECRET = prevSec;
    if (prevMode === undefined) delete process.env.CCPAYMENT_WEBHOOK_SIGN_MODE;
    else process.env.CCPAYMENT_WEBHOOK_SIGN_MODE = prevMode;
  }
});

test("verifyCcpaymentWebhookRequest throws INVALID_SIGNATURE on bad sign", () => {
  const prevId = process.env.CCPAYMENT_APP_ID;
  const prevSec = process.env.CCPAYMENT_APP_SECRET;
  process.env.CCPAYMENT_APP_ID = "a";
  process.env.CCPAYMENT_APP_SECRET = "b";
  try {
    assert.throws(
      () =>
        verifyCcpaymentWebhookRequest("{}", {
          appid: "a",
          timestamp: String(Math.floor(Date.now() / 1000)),
          sign: "bad"
        }),
      (err) => err instanceof CcpaymentWebhookError && err.code === "INVALID_SIGNATURE"
    );
  } finally {
    if (prevId === undefined) delete process.env.CCPAYMENT_APP_ID;
    else process.env.CCPAYMENT_APP_ID = prevId;
    if (prevSec === undefined) delete process.env.CCPAYMENT_APP_SECRET;
    else process.env.CCPAYMENT_APP_SECRET = prevSec;
  }
});
