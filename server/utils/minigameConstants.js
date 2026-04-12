/** Slug for `Game` row tied to temporary hashrate from the Hash Tap Sprint minigame. */
export const MINIGAME_GAME_SLUG = "hash-tap-sprint";

/** Play window enforced on the server (ms). */
export const MINIGAME_DURATION_MS = 69_000;

/** Cooldown after a rewarded completion (ms) — 3 minutes. */
export const MINIGAME_COOLDOWN_MS = 180_000;

/** Temporary hashrate granted on success (H/s). */
export const MINIGAME_REWARD_HASHRATE = 25;

/** Allow completion this many ms before `endsAt` (client / request timing). */
export const MINIGAME_COMPLETE_EARLY_MS = 1_500;

/** Allow completion this many ms after `endsAt` (network latency). */
export const MINIGAME_COMPLETE_LATE_MS = 120_000;
