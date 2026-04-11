import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeTaskMetadata } from "../server/services/internalOfferwall/internalOfferwallTaskMetadata.js";
import { OFFER_KIND_GENERAL_TASK, OFFER_KIND_PTC_IFRAME } from "../server/services/internalOfferwall/internalOfferwallConstants.js";

describe("normalizeTaskMetadata", () => {
  it("returns null for empty input", () => {
    const r = normalizeTaskMetadata(OFFER_KIND_GENERAL_TASK, null);
    assert.equal(r.ok, true);
    assert.equal(r.value, null);
  });

  it("normalizes required actions", () => {
    const r = normalizeTaskMetadata(OFFER_KIND_GENERAL_TASK, {
      requiredActions: ["  Visit page ", ""]
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value?.requiredActions, ["Visit page"]);
  });

  it("rejects external URL on PTC kind", () => {
    const r = normalizeTaskMetadata(OFFER_KIND_PTC_IFRAME, {
      externalInfoUrl: "https://example.com/x"
    });
    assert.equal(r.ok, false);
  });
});
