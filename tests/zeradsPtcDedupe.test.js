import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildZeradsPtcCallbackHash,
  parseZeradsAmountZer,
  parseZeradsClicks,
  ZERADS_PTC_DEDUPE_BUCKET_MS
} from "../server/utils/zeradsPtcDedupe.js";

describe("zeradsPtcDedupe", () => {
  it("parses ZER amount", () => {
    assert.equal(parseZeradsAmountZer("0.01").ok, true);
    assert.equal(/** @type {{ ok: true, value: number }} */ (parseZeradsAmountZer("0.01")).value, 0.01);
    assert.equal(parseZeradsAmountZer("x").ok, false);
    assert.equal(parseZeradsAmountZer("-1").ok, false);
  });

  it("parses clicks safely", () => {
    assert.equal(parseZeradsClicks(""), 0);
    assert.equal(parseZeradsClicks("3"), 3);
    assert.equal(parseZeradsClicks(999999999), 1_000_000);
  });

  it("buildZeradsPtcCallbackHash is stable for same bucket", () => {
    const t = new Date(ZERADS_PTC_DEDUPE_BUCKET_MS * 42);
    const a = buildZeradsPtcCallbackHash({
      externalUser: "u9_abcd1234",
      amountZer: 0.01,
      clicks: 2,
      at: t
    });
    const b = buildZeradsPtcCallbackHash({
      externalUser: "u9_abcd1234",
      amountZer: 0.01,
      clicks: 2,
      at: new Date(t.getTime() + 30_000)
    });
    assert.equal(a, b);
  });

  it("buildZeradsPtcCallbackHash changes across 5-minute buckets", () => {
    const t1 = new Date(ZERADS_PTC_DEDUPE_BUCKET_MS * 10);
    const t2 = new Date(ZERADS_PTC_DEDUPE_BUCKET_MS * 11);
    const a = buildZeradsPtcCallbackHash({
      externalUser: "u9_abcd1234",
      amountZer: 0.01,
      clicks: 1,
      at: t1
    });
    const b = buildZeradsPtcCallbackHash({
      externalUser: "u9_abcd1234",
      amountZer: 0.01,
      clicks: 1,
      at: t2
    });
    assert.notEqual(a, b);
  });
});
