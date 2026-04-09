/**
 * Production may run code before Auto Mining v2 migrations are applied.
 * Probes once whether Prisma can query v2 models; callers skip v2 queries when false.
 */

import prisma from "../../src/db/prisma.js";
import loggerLib from "../../utils/logger.js";

const logger = loggerLib.child("AutoMiningV2Db");

/** @type {boolean | null} */
let cached = null;

export function resetAutoMiningV2AvailabilityCache() {
  cached = null;
}

/**
 * @returns {Promise<boolean>}
 */
export async function isAutoMiningV2SchemaAvailable() {
  if (cached !== null) return cached;
  try {
    await prisma.autoMiningV2PowerGrant.findFirst({ select: { id: true } });
    cached = true;
  } catch (e) {
    logger.warn("Auto Mining v2 tables unavailable; skipping v2 queries until migrations are applied.", {
      message: String(e?.message || e)
    });
    cached = false;
  }
  return cached;
}
