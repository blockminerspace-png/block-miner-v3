import { Prisma } from "../../src/db/prismaNamespace.js";
import prisma from "../../src/db/prisma.js";
import { getDailyTaskPeriodKey } from "../dailyTasks/dailyTaskPeriod.js";
import { bumpDailyTasksForUser } from "../dailyTasks/dailyTaskProgressService.js";
import { TASK_INTERNAL_OFFERWALL } from "../dailyTasks/dailyTaskConstants.js";
import { buildUserAuditSnapshotJson } from "./buildUserAuditSnapshot.js";
import { grantInternalOfferwallRewardInTx } from "./grantInternalOfferwallReward.js";
import {
  ATTEMPT_STATUS_COMPLETED,
  ATTEMPT_STATUS_PENDING_REVIEW,
  ATTEMPT_STATUS_REJECTED,
  ATTEMPT_STATUS_STARTED,
  COMPLETION_ADMIN_APPROVAL,
  COMPLETION_USER_SELF_CLAIM,
  OFFER_KIND_GENERAL_TASK,
  OFFER_KIND_PTC_IFRAME,
  REWARD_BLK,
  REWARD_HASHRATE_TEMP,
  REWARD_POL
} from "./internalOfferwallConstants.js";
import {
  isAllowHttpIframe,
  loadIframeHostAllowlist,
  validateIframeUrl
} from "./validateIframeUrl.js";
import { isInternalOfferwallEnabled } from "./internalOfferwallFeature.js";

/**
 * @param {unknown} v
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
function clampInt(v, min, max, fallback) {
  const n = parseInt(String(v ?? ""), 10);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {object} body
 * @returns {{ ok: true, data: object } | { ok: false, status: number, message: string, code?: string }}
 */
export function parseAdminOfferBody(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, message: "Invalid JSON body." };
  }
  const b = /** @type {Record<string, unknown>} */ (body);
  const kind = String(b.kind || "").trim().toUpperCase();
  if (kind !== OFFER_KIND_PTC_IFRAME && kind !== OFFER_KIND_GENERAL_TASK) {
    return { ok: false, status: 400, message: "Invalid offer kind." };
  }
  const title = String(b.title || "").trim();
  if (!title || title.length > 200) {
    return { ok: false, status: 400, message: "Title is required (max 200 chars)." };
  }
  const description =
    b.description === undefined || b.description === null
      ? null
      : String(b.description).trim().slice(0, 8000) || null;

  let iframeUrl = null;
  if (kind === OFFER_KIND_PTC_IFRAME) {
    const hosts = loadIframeHostAllowlist();
    const vr = validateIframeUrl(String(b.iframeUrl || ""), {
      allowHttp: isAllowHttpIframe(),
      allowedHosts: hosts
    });
    if (!vr.ok) {
      return { ok: false, status: 400, message: vr.message, code: vr.code };
    }
    iframeUrl = vr.url;
  } else if (b.iframeUrl !== undefined && String(b.iframeUrl).trim()) {
    return { ok: false, status: 400, message: "General tasks must not include an iframe URL." };
  }

  const minViewSeconds = clampInt(b.minViewSeconds, 0, 7200, 10);
  const dailyLimitPerUser = clampInt(b.dailyLimitPerUser, 1, 50, 3);
  const sortOrder = clampInt(b.sortOrder, 0, 99999, 0);

  const rewardKind = String(b.rewardKind || "").trim().toUpperCase();
  if (![REWARD_BLK, REWARD_POL, REWARD_HASHRATE_TEMP].includes(rewardKind)) {
    return { ok: false, status: 400, message: "Invalid reward kind (use BLK, POL, or HASHRATE_TEMP)." };
  }

  const data = {
    kind,
    title,
    description,
    iframeUrl,
    minViewSeconds,
    rewardKind,
    dailyLimitPerUser,
    sortOrder,
    isActive: typeof b.isActive === "boolean" ? b.isActive : true,
    completionMode:
      String(b.completionMode || "").trim().toUpperCase() === COMPLETION_ADMIN_APPROVAL
        ? COMPLETION_ADMIN_APPROVAL
        : COMPLETION_USER_SELF_CLAIM
  };

  if (rewardKind === REWARD_BLK) {
    const a = parseFloat(String(b.rewardBlkAmount ?? ""));
    if (!Number.isFinite(a) || a <= 0) {
      return { ok: false, status: 400, message: "BLK reward requires a positive rewardBlkAmount." };
    }
    data.rewardBlkAmount = new Prisma.Decimal(String(a));
  } else if (rewardKind === REWARD_POL) {
    const a = parseFloat(String(b.rewardPolAmount ?? ""));
    if (!Number.isFinite(a) || a <= 0) {
      return { ok: false, status: 400, message: "POL reward requires a positive rewardPolAmount." };
    }
    data.rewardPolAmount = new Prisma.Decimal(String(a));
  } else {
    const hr = parseFloat(String(b.rewardHashRate ?? ""));
    const days = clampInt(b.rewardHashRateDays, 1, 365, 1);
    if (!Number.isFinite(hr) || hr <= 0) {
      return { ok: false, status: 400, message: "HASHRATE_TEMP requires a positive rewardHashRate." };
    }
    data.rewardHashRate = hr;
    data.rewardHashRateDays = days;
  }

  return { ok: true, data };
}

export async function adminListOffers() {
  return prisma.internalOfferwallOffer.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
  });
}

/**
 * @param {object} data
 */
export async function adminCreateOffer(data) {
  return prisma.internalOfferwallOffer.create({ data });
}

/**
 * @param {number} id
 * @param {object} patch
 */
export async function adminPatchOffer(id, patch) {
  return prisma.internalOfferwallOffer.update({
    where: { id },
    data: patch
  });
}

export async function adminListAttempts({ status, offerId, limit }) {
  const where = {};
  if (status) where.status = String(status);
  if (offerId) where.offerId = offerId;
  return prisma.internalOfferwallAttempt.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: Math.min(200, Math.max(1, limit || 50)),
    include: {
      offer: { select: { id: true, title: true, kind: true } },
      user: { select: { id: true, email: true, username: true } }
    }
  });
}

function publicOfferShape(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    iframeUrl: row.kind === OFFER_KIND_PTC_IFRAME ? row.iframeUrl : null,
    minViewSeconds: row.minViewSeconds,
    rewardKind: row.rewardKind,
    rewardBlkAmount: row.rewardBlkAmount?.toString?.() ?? null,
    rewardPolAmount: row.rewardPolAmount?.toString?.() ?? null,
    rewardHashRate: row.rewardHashRate,
    rewardHashRateDays: row.rewardHashRateDays,
    completionMode: row.completionMode,
    sortOrder: row.sortOrder
  };
}

export async function userListOffers(userId) {
  if (!isInternalOfferwallEnabled()) {
    return { ok: false, code: "FEATURE_DISABLED", offers: [], openAttempts: [] };
  }
  const periodKey = getDailyTaskPeriodKey();
  const offers = await prisma.internalOfferwallOffer.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
  });
  const openRows = await prisma.internalOfferwallAttempt.findMany({
    where: {
      userId,
      periodKey,
      status: { in: [ATTEMPT_STATUS_STARTED, ATTEMPT_STATUS_PENDING_REVIEW] }
    },
    include: { offer: true }
  });
  const openAttempts = openRows.map((open) => ({
    id: open.id,
    offerId: open.offerId,
    status: open.status,
    startedAt: open.startedAt.toISOString(),
    offer: publicOfferShape(open.offer)
  }));
  return {
    ok: true,
    offers: offers.map(publicOfferShape),
    openAttempts
  };
}

/**
 * @param {number} userId
 * @param {number} offerId
 */
export async function userStartOffer(userId, offerId) {
  if (!isInternalOfferwallEnabled()) {
    return { ok: false, status: 403, code: "FEATURE_DISABLED", message: "This feature is disabled." };
  }
  const offer = await prisma.internalOfferwallOffer.findFirst({
    where: { id: offerId, isActive: true }
  });
  if (!offer) {
    return { ok: false, status: 404, code: "OFFER_NOT_FOUND", message: "Offer not found or inactive." };
  }

  const periodKey = getDailyTaskPeriodKey();
  const completedCount = await prisma.internalOfferwallAttempt.count({
    where: {
      userId,
      offerId,
      periodKey,
      status: ATTEMPT_STATUS_COMPLETED
    }
  });
  if (completedCount >= offer.dailyLimitPerUser) {
    return { ok: false, status: 429, code: "DAILY_LIMIT", message: "Daily limit reached for this offer." };
  }

  const existing = await prisma.internalOfferwallAttempt.findFirst({
    where: {
      userId,
      offerId,
      periodKey,
      status: { in: [ATTEMPT_STATUS_STARTED, ATTEMPT_STATUS_PENDING_REVIEW] }
    }
  });
  if (existing) {
    return {
      ok: true,
      attempt: {
        id: existing.id,
        offerId: existing.offerId,
        status: existing.status,
        startedAt: existing.startedAt.toISOString()
      }
    };
  }

  const attempt = await prisma.internalOfferwallAttempt.create({
    data: {
      userId,
      offerId,
      periodKey,
      status: ATTEMPT_STATUS_STARTED,
      startedAt: new Date()
    }
  });
  return {
    ok: true,
    attempt: {
      id: attempt.id,
      offerId: attempt.offerId,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString()
    }
  };
}

/**
 * @param {number} userId
 * @param {number} attemptId
 */
export async function userSubmitAttempt(userId, attemptId) {
  if (!isInternalOfferwallEnabled()) {
    return { ok: false, status: 403, code: "FEATURE_DISABLED", message: "This feature is disabled." };
  }
  const attempt = await prisma.internalOfferwallAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { offer: true }
  });
  if (!attempt || !attempt.offer?.isActive) {
    return { ok: false, status: 404, code: "ATTEMPT_NOT_FOUND", message: "Attempt not found." };
  }
  if (attempt.status !== ATTEMPT_STATUS_STARTED) {
    return { ok: false, status: 400, code: "INVALID_STATE", message: "This attempt cannot be submitted now." };
  }

  const now = new Date();
  const elapsedSec = (now.getTime() - attempt.startedAt.getTime()) / 1000;
  if (elapsedSec < attempt.offer.minViewSeconds) {
    return {
      ok: false,
      status: 400,
      code: "MIN_VIEW_NOT_MET",
      message: "Keep the task open for the required time before submitting."
    };
  }

  if (attempt.offer.completionMode === COMPLETION_ADMIN_APPROVAL) {
    const snap = await buildUserAuditSnapshotJson(userId);
    await prisma.internalOfferwallAttempt.update({
      where: { id: attempt.id },
      data: {
        status: ATTEMPT_STATUS_PENDING_REVIEW,
        submittedAt: now,
        auditSnapshot: snap
      }
    });
    return {
      ok: true,
      status: "PENDING_REVIEW",
      message: "Submitted for review. You will receive the reward after approval."
    };
  }

  // Self-claim: grant + complete in one transaction
  const snap = await buildUserAuditSnapshotJson(userId);
  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.internalOfferwallAttempt.findFirst({
        where: { id: attemptId, userId, status: ATTEMPT_STATUS_STARTED }
      });
      if (!fresh) throw new Error("CONFLICT");

      await grantInternalOfferwallRewardInTx(tx, {
        userId,
        rewardKind: attempt.offer.rewardKind,
        rewardBlkAmount: attempt.offer.rewardBlkAmount,
        rewardPolAmount: attempt.offer.rewardPolAmount,
        rewardHashRate: attempt.offer.rewardHashRate,
        rewardHashRateDays: attempt.offer.rewardHashRateDays
      });

      await tx.internalOfferwallAttempt.update({
        where: { id: attemptId },
        data: {
          status: ATTEMPT_STATUS_COMPLETED,
          submittedAt: now,
          completedAt: now,
          rewardGrantedAt: now,
          auditSnapshot: snap
        }
      });
    });
  } catch (e) {
    if (String(e.message) === "CONFLICT") {
      return { ok: false, status: 409, code: "CONFLICT", message: "Attempt was already updated." };
    }
    throw e;
  }

  await bumpDailyTasksForUser(userId, TASK_INTERNAL_OFFERWALL, {
    dedupeKey: `iof-complete:${attemptId}`,
    delta: 1,
    internalOfferwallOfferId: attempt.offerId
  });

  const { syncUserBaseHashRate } = await import("../../models/minerProfileModel.js");
  const { getMiningEngine } = await import("../../src/miningEngineInstance.js");
  if (String(attempt.offer.rewardKind).toUpperCase() === REWARD_HASHRATE_TEMP) {
    await syncUserBaseHashRate(userId);
    getMiningEngine()?.reloadMinerProfile(userId).catch(() => {});
  }

  return {
    ok: true,
    status: "COMPLETED",
    message: "Reward granted."
  };
}

/**
 * @param {number} attemptId
 */
export async function adminApproveAttempt(attemptId) {
  const attempt = await prisma.internalOfferwallAttempt.findFirst({
    where: { id: attemptId, status: ATTEMPT_STATUS_PENDING_REVIEW },
    include: { offer: true }
  });
  if (!attempt || !attempt.offer) {
    return { ok: false, status: 404, message: "Pending attempt not found." };
  }
  if (!attempt.offer.isActive) {
    return { ok: false, status: 400, message: "Offer is inactive." };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const row = await tx.internalOfferwallAttempt.findFirst({
      where: { id: attemptId, status: ATTEMPT_STATUS_PENDING_REVIEW }
    });
    if (!row) throw new Error("gone");

    await grantInternalOfferwallRewardInTx(tx, {
      userId: attempt.userId,
      rewardKind: attempt.offer.rewardKind,
      rewardBlkAmount: attempt.offer.rewardBlkAmount,
      rewardPolAmount: attempt.offer.rewardPolAmount,
      rewardHashRate: attempt.offer.rewardHashRate,
      rewardHashRateDays: attempt.offer.rewardHashRateDays
    });

    await tx.internalOfferwallAttempt.update({
      where: { id: attemptId },
      data: {
        status: ATTEMPT_STATUS_COMPLETED,
        completedAt: now,
        rewardGrantedAt: now
      }
    });
  });

  await bumpDailyTasksForUser(attempt.userId, TASK_INTERNAL_OFFERWALL, {
    dedupeKey: `iof-complete:${attemptId}`,
    delta: 1,
    internalOfferwallOfferId: attempt.offerId
  });

  const { syncUserBaseHashRate } = await import("../../models/minerProfileModel.js");
  const { getMiningEngine } = await import("../../src/miningEngineInstance.js");
  if (String(attempt.offer.rewardKind).toUpperCase() === REWARD_HASHRATE_TEMP) {
    await syncUserBaseHashRate(attempt.userId);
    getMiningEngine()?.reloadMinerProfile(attempt.userId).catch(() => {});
  }

  return { ok: true };
}

/**
 * @param {number} attemptId
 * @param {string} [note]
 */
export async function adminRejectAttempt(attemptId, note) {
  const attempt = await prisma.internalOfferwallAttempt.findFirst({
    where: { id: attemptId, status: ATTEMPT_STATUS_PENDING_REVIEW }
  });
  if (!attempt) {
    return { ok: false, status: 404, message: "Pending attempt not found." };
  }
  await prisma.internalOfferwallAttempt.update({
    where: { id: attemptId },
    data: {
      status: ATTEMPT_STATUS_REJECTED,
      completedAt: new Date(),
      adminNote: note ? String(note).slice(0, 2000) : null
    }
  });
  return { ok: true };
}
