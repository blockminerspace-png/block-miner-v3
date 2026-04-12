import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCooldownEndsAt,
  isWithinCompleteWindow
} from "../server/services/minigameService.js";
import {
  MINIGAME_COMPLETE_EARLY_MS,
  MINIGAME_COMPLETE_LATE_MS,
  MINIGAME_COOLDOWN_MS
} from "../server/utils/minigameConstants.js";

describe("minigameService helpers", () => {
  it("computeCooldownEndsAt returns null when cooldown elapsed", () => {
    const completedAt = new Date("2026-04-12T12:00:00.000Z");
    const now = new Date(completedAt.getTime() + MINIGAME_COOLDOWN_MS + 1000);
    assert.equal(computeCooldownEndsAt(completedAt, now), null);
  });

  it("computeCooldownEndsAt returns end when still inside cooldown", () => {
    const completedAt = new Date("2026-04-12T12:00:00.000Z");
    const now = new Date(completedAt.getTime() + 60_000);
    const end = computeCooldownEndsAt(completedAt, now);
    assert.ok(end instanceof Date);
    assert.ok(end.getTime() > now.getTime());
  });

  it("isWithinCompleteWindow accepts just before endsAt (within early skew)", () => {
    const endsAt = new Date("2026-04-12T12:01:09.000Z");
    const now = new Date(endsAt.getTime() - MINIGAME_COMPLETE_EARLY_MS + 100);
    assert.equal(isWithinCompleteWindow({ endsAt, now }), true);
  });

  it("isWithinCompleteWindow rejects far before endsAt", () => {
    const endsAt = new Date("2026-04-12T12:01:09.000Z");
    const now = new Date(endsAt.getTime() - MINIGAME_COMPLETE_EARLY_MS - 5000);
    assert.equal(isWithinCompleteWindow({ endsAt, now }), false);
  });

  it("isWithinCompleteWindow accepts shortly after endsAt", () => {
    const endsAt = new Date("2026-04-12T12:01:09.000Z");
    const now = new Date(endsAt.getTime() + MINIGAME_COMPLETE_LATE_MS - 1000);
    assert.equal(isWithinCompleteWindow({ endsAt, now }), true);
  });

  it("isWithinCompleteWindow rejects far after endsAt", () => {
    const endsAt = new Date("2026-04-12T12:01:09.000Z");
    const now = new Date(endsAt.getTime() + MINIGAME_COMPLETE_LATE_MS + 5000);
    assert.equal(isWithinCompleteWindow({ endsAt, now }), false);
  });
});
