import prisma from "../src/db/prisma.js";
import { syncUserBaseHashRate } from "../models/minerProfileModel.js";
import { getMiningEngine } from "../src/miningEngineInstance.js";
import {
  MINIGAME_GAME_SLUG,
  MINIGAME_COOLDOWN_MS,
  MINIGAME_COMPLETE_EARLY_MS,
  MINIGAME_COMPLETE_LATE_MS,
  MINIGAME_DURATION_MS,
  MINIGAME_REWARD_HASHRATE
} from "../utils/minigameConstants.js";

const SESSION_ACTIVE = "ACTIVE";
const SESSION_COMPLETED = "COMPLETED";
const SESSION_EXPIRED = "EXPIRED";

/**
 * @param {Date | null | undefined} completedAt
 * @param {Date} now
 * @returns {Date | null}
 */
export function computeCooldownEndsAt(completedAt, now) {
  if (!completedAt) return null;
  const end = new Date(completedAt.getTime() + MINIGAME_COOLDOWN_MS);
  return end > now ? end : null;
}

/**
 * @param {{ endsAt: Date; now: Date }} args
 * @returns {boolean}
 */
export function isWithinCompleteWindow({ endsAt, now }) {
  const t = now.getTime();
  return (
    t >= endsAt.getTime() - MINIGAME_COMPLETE_EARLY_MS &&
    t <= endsAt.getTime() + MINIGAME_COMPLETE_LATE_MS
  );
}

/**
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 */
async function getOrCreateMinigameGameId(tx) {
  const g = await tx.game.upsert({
    where: { slug: MINIGAME_GAME_SLUG },
    create: {
      name: "Hash Tap Sprint",
      slug: MINIGAME_GAME_SLUG,
      isActive: true
    },
    update: {}
  });
  return g.id;
}

/**
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {number} userId
 * @param {Date} now
 */
async function expireStaleActiveSessions(tx, userId, now) {
  const threshold = new Date(now.getTime() - MINIGAME_COMPLETE_LATE_MS);
  await tx.minigameSession.updateMany({
    where: {
      userId,
      status: SESSION_ACTIVE,
      endsAt: { lte: threshold }
    },
    data: { status: SESSION_EXPIRED }
  });
}

/**
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {number} userId
 */
async function lockUserForMinigame(tx, userId) {
  await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${userId} FOR UPDATE`;
}

/**
 * @param {number} userId
 * @param {Date} [now]
 */
export async function getMinigameStatus(userId, now = new Date()) {
  await prisma.$transaction(async (tx) => {
    await lockUserForMinigame(tx, userId);
    await expireStaleActiveSessions(tx, userId, now);
  });

  const lastRewarded = await prisma.minigameSession.findFirst({
    where: { userId, status: SESSION_COMPLETED, rewardGranted: true },
    orderBy: { completedAt: "desc" }
  });

  const cooldownEndsAt = computeCooldownEndsAt(lastRewarded?.completedAt ?? null, now);

  const active = await prisma.minigameSession.findFirst({
    where: { userId, status: SESSION_ACTIVE },
    orderBy: { id: "desc" }
  });

  return {
    ok: true,
    /** True when the user may call `start` to create a brand-new session (no active round). */
    allowNewStart: !cooldownEndsAt && !active,
    cooldownEndsAt: cooldownEndsAt ? cooldownEndsAt.toISOString() : null,
    cooldownSecondsRemaining: cooldownEndsAt
      ? Math.max(0, Math.ceil((cooldownEndsAt.getTime() - now.getTime()) / 1000))
      : 0,
    activeSession: active
      ? {
          id: active.id,
          startedAt: active.startedAt.toISOString(),
          endsAt: active.endsAt.toISOString(),
          status: active.status
        }
      : null,
    rewardHashRate: MINIGAME_REWARD_HASHRATE,
    durationSeconds: Math.round(MINIGAME_DURATION_MS / 1000)
  };
}

/**
 * @param {number} userId
 * @param {Date} [now]
 */
export async function startMinigameSession(userId, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await lockUserForMinigame(tx, userId);
    await expireStaleActiveSessions(tx, userId, now);

    const lastRewarded = await tx.minigameSession.findFirst({
      where: { userId, status: SESSION_COMPLETED, rewardGranted: true },
      orderBy: { completedAt: "desc" }
    });
    const cd = computeCooldownEndsAt(lastRewarded?.completedAt ?? null, now);
    if (cd) {
      return {
        ok: false,
        code: "COOLDOWN_ACTIVE",
        status: 429,
        cooldownEndsAt: cd.toISOString(),
        cooldownSecondsRemaining: Math.max(0, Math.ceil((cd.getTime() - now.getTime()) / 1000))
      };
    }

    const existing = await tx.minigameSession.findFirst({
      where: { userId, status: SESSION_ACTIVE },
      orderBy: { id: "desc" }
    });
    if (existing) {
      return {
        ok: true,
        reused: true,
        session: {
          id: existing.id,
          startedAt: existing.startedAt.toISOString(),
          endsAt: existing.endsAt.toISOString(),
          durationSeconds: Math.round(MINIGAME_DURATION_MS / 1000),
          rewardHashRate: MINIGAME_REWARD_HASHRATE
        }
      };
    }

    const startedAt = now;
    const endsAt = new Date(now.getTime() + MINIGAME_DURATION_MS);
    const row = await tx.minigameSession.create({
      data: {
        userId,
        status: SESSION_ACTIVE,
        startedAt,
        endsAt,
        rewardGranted: false
      }
    });

    return {
      ok: true,
      reused: false,
      session: {
        id: row.id,
        startedAt: row.startedAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        durationSeconds: Math.round(MINIGAME_DURATION_MS / 1000),
        rewardHashRate: MINIGAME_REWARD_HASHRATE
      }
    };
  });
}

function powerDaysFromEnv() {
  const n = Number(process.env.MINIGAME_POWER_DAYS || process.env.YT_POWER_DAYS || 7);
  return Math.max(1, Math.min(365, Math.floor(Number.isFinite(n) ? n : 7)));
}

/**
 * @param {number} userId
 * @param {number} sessionId
 * @param {object} [meta]
 * @param {string | null} [meta.ip]
 * @param {string | null} [meta.userAgent]
 * @param {Date} [now]
 */
export async function completeMinigameSession(userId, sessionId, meta = {}, now = new Date()) {
  const sid = Math.floor(Number(sessionId));
  if (!sid) {
    return { ok: false, code: "INVALID_SESSION", status: 400 };
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockUserForMinigame(tx, userId);
    await expireStaleActiveSessions(tx, userId, now);

    const row = await tx.minigameSession.findFirst({
      where: { id: sid, userId }
    });
    if (!row) {
      return { ok: false, code: "SESSION_NOT_FOUND", status: 404 };
    }
    if (row.status === SESSION_COMPLETED && row.rewardGranted) {
      const powerDays = powerDaysFromEnv();
      const cd = computeCooldownEndsAt(row.completedAt, now);
      return {
        ok: true,
        idempotent: true,
        rewardHashRate: MINIGAME_REWARD_HASHRATE,
        powerDays,
        nextPlayAllowedAt: cd ? cd.toISOString() : null,
        cooldownSecondsRemaining: cd
          ? Math.max(0, Math.ceil((cd.getTime() - now.getTime()) / 1000))
          : 0
      };
    }
    if (row.status !== SESSION_ACTIVE) {
      return { ok: false, code: "SESSION_NOT_ACTIVE", status: 409 };
    }

    if (!isWithinCompleteWindow({ endsAt: row.endsAt, now })) {
      if (now.getTime() < row.endsAt.getTime() - MINIGAME_COMPLETE_EARLY_MS) {
        return { ok: false, code: "TOO_EARLY", status: 400 };
      }
      await tx.minigameSession.update({
        where: { id: row.id },
        data: { status: SESSION_EXPIRED }
      });
      return { ok: false, code: "SESSION_EXPIRED", status: 409 };
    }

    const gameId = await getOrCreateMinigameGameId(tx);
    const playedAt = now;
    const expiresAt = new Date(playedAt.getTime() + powerDaysFromEnv() * 86_400_000);

    await tx.userPowerGame.create({
      data: {
        userId,
        gameId,
        hashRate: MINIGAME_REWARD_HASHRATE,
        playedAt,
        expiresAt
      }
    });

    await tx.minigameSession.update({
      where: { id: row.id },
      data: {
        status: SESSION_COMPLETED,
        completedAt: playedAt,
        rewardGranted: true
      }
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "minigame_complete",
        ip: meta.ip ? String(meta.ip).slice(0, 64) : null,
        userAgent: meta.userAgent ? String(meta.userAgent).slice(0, 512) : null,
        detailsJson: JSON.stringify({
          sessionId: row.id,
          hashRate: MINIGAME_REWARD_HASHRATE,
          expiresAt: expiresAt.toISOString()
        })
      }
    });

    const cd = new Date(playedAt.getTime() + MINIGAME_COOLDOWN_MS);
    return {
      ok: true,
      idempotent: false,
      rewardHashRate: MINIGAME_REWARD_HASHRATE,
      powerDays: powerDaysFromEnv(),
      nextPlayAllowedAt: cd.toISOString(),
      cooldownSecondsRemaining: Math.max(0, Math.ceil((cd.getTime() - now.getTime()) / 1000))
    };
  });

  if (result.ok && !result.idempotent) {
    try {
      const newTotal = await syncUserBaseHashRate(userId);
      const engine = getMiningEngine();
      if (engine) {
        const miner = engine.findMinerByUserId(userId);
        if (miner) miner.baseHashRate = newTotal;
        if (engine.io) engine.io.to(`user:${userId}`).emit("machines:update");
      }
    } catch {
      /* non-fatal */
    }
  }

  return result;
}
