/**
 * CCPayment deposit address — v2 retry heuristic and chain retry helpers (unit).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { shouldRetryDepositAddressWithV2Api } from "../server/services/ccpayment/ccpaymentApiClient.js";

test("shouldRetryDepositAddressWithV2Api detects common CCPayment v2-only messages", () => {
  assert.equal(shouldRetryDepositAddressWithV2Api("only call api of version 2"), true);
  assert.equal(shouldRetryDepositAddressWithV2Api("Please use version 2 API"), true);
  assert.equal(shouldRetryDepositAddressWithV2Api("invalid signature"), false);
  assert.equal(shouldRetryDepositAddressWithV2Api(""), false);
});
