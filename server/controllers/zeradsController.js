import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../src/db/prisma.js";
import loggerLib from "../utils/logger.js";
import {
  assertZerAdsCallbackAuthorized,
  getZerAdsSecretFromEnv,
  getZerAdsProvidedSecretFromPayload,
  isStrongZerAdsSecret,
  parseIpAllowlist,
  isRequestIpAllowlisted,
  zeradsInsecureCallbacksAllowed
} from "../utils/zeradsCallbackSecurity.js";
import {
  buildZeradsPtcCallbackHash,
  parseZeradsAmountZer,
  parseZeradsClicks
} from "../utils/zeradsPtcDedupe.js";
import { resolveRequestPublicOrigin } from "../utils/requestPublicOrigin.js";
import { createNotification } from "./notificationController.js";
import { getMiningEngine } from "../src/miningEngineInstance.js";

const logger = loggerLib.child("ZerAdsController");
const ZERADS_SITE_ID = process.env.ZERADS_SITE_ID || "10776";
const ZERADS_PTC_EXCHANGE_RATE = Number(process.env.ZERADS_PTC_EXCHANGE_RATE);
const ZERADS_EXCHANGE =
  Number.isFinite(ZERADS_PTC_EXCHANGE_RATE) && ZERADS_PTC_EXCHANGE_RATE > 0 ? ZERADS_PTC_EXCHANGE_RATE : 0.07;
const ZERADS_ALLOWED_IPS = parseIpAllowlist(process.env.ZERADS_ALLOWED_IPS || "");
const ZERADS_REWARD_NAME = String(process.env.ZERADS_REWARD_NAME || "POL").trim() || "POL";
const MAX_ZER_PER_CALLBACK = Number(process.env.ZERADS_MAX_ZER_PER_CALLBACK || 500);
const MAX_POL_PER_CALLBACK = Number(process.env.ZERADS_MAX_POL_PER_CALLBACK || 250);

function parseExternalUserId(externalUser) {
  const m = String(externalUser).match(/^u(\d+)_/);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function redirectToTestPtcLink(_req, res) {
  const ref = encodeURIComponent(String(ZERADS_SITE_ID));
  res.redirect(302, `https://zerads.com/ptc.php?ref=${ref}`);
}

export async function getPtcLink(req, res) {
  try {
    const userId = req.user.id;
    const externalUser = `u${userId}_${crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 8)}`;
    const ptcUrl = `https://zerads.com/ptc.php?ref=${ZERADS_SITE_ID}&user=${encodeURIComponent(externalUser)}`;
    res.json({
      ok: true,
      ptcUrl,
      externalUser,
      rewardName: ZERADS_REWARD_NAME,
      exchangeRate: ZERADS_EXCHANGE,
      clientOrigin: resolveRequestPublicOrigin(req)
    });
  } catch {
    res.status(500).json({ ok: false, message: "Error generating link." });
  }
}

export async function handlePtcCallback(req, res) {
  try {
    const payload =
      req.body && typeof req.body === "object" && Object.keys(req.body).length > 0 ? req.body : req.query;
    const externalUser = payload.user;
    const amountRaw = payload.amount;
    const clicksParsed = parseZeradsClicks(payload.clicks);
    const providedSecret = getZerAdsProvidedSecretFromPayload(payload);

    if (!externalUser || amountRaw == null || amountRaw === "") {
      return res.status(400).send("missing_params");
    }

    if (!isRequestIpAllowlisted(req, ZERADS_ALLOWED_IPS)) {
      logger.warn("ZerAds callback rejected: IP not in allowlist", { ip: req.ip });
      return res.status(403).send("unauthorized");
    }

    const configuredSecret = getZerAdsSecretFromEnv();
    const auth = assertZerAdsCallbackAuthorized({ configuredSecret, providedSecret });
    if (!auth.ok) {
      if (auth.status === 403) {
        logger.warn("ZerAds callback rejected: invalid secret", { user: String(externalUser).slice(0, 48) });
      } else {
        logger.warn("ZerAds callback rejected: server secret not configured");
      }
      return res.status(auth.status).send(auth.body);
    }

    if (!isStrongZerAdsSecret(configuredSecret) && zeradsInsecureCallbacksAllowed()) {
      logger.warn("ZerAds callback accepted without strong ZERADS_SECRET_KEY (dev-only insecure mode)", {
        ip: req.ip
      });
    }

    const userId = parseExternalUserId(externalUser);
    if (!userId) return res.status(400).send("invalid_user");

    const amountParsed = parseZeradsAmountZer(amountRaw);
    if (!amountParsed.ok) return res.status(400).send(amountParsed.reason);
    const amountNum = amountParsed.value;
    if (amountNum === 0 && clicksParsed === 0) return res.status(400).send("empty_payout");

    if (amountNum > MAX_ZER_PER_CALLBACK) {
      logger.warn("ZerAds callback rejected: amount cap", { userId, amountNum });
      return res.status(400).send("amount_too_large");
    }

    const payoutDec = new Prisma.Decimal(String(amountNum)).mul(new Prisma.Decimal(String(ZERADS_EXCHANGE)));
    if (payoutDec.gt(new Prisma.Decimal(String(MAX_POL_PER_CALLBACK)))) {
      logger.warn("ZerAds callback rejected: POL cap", { userId, amountNum });
      return res.status(400).send("payout_too_large");
    }

    const requestIp = String(req.ip || "").slice(0, 128);
    const now = new Date();
    const callbackHash = buildZeradsPtcCallbackHash({
      externalUser: String(externalUser),
      amountZer: amountNum,
      clicks: clicksParsed,
      at: now
    });

    const payoutFloat = payoutDec.toNumber();

    let duplicate = false;
    let credited = false;

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, isBanned: true, username: true }
      });
      if (!user) {
        throw Object.assign(new Error("user_not_found"), { code: "user_not_found" });
      }
      if (user.isBanned) {
        throw Object.assign(new Error("user_banned"), { code: "user_banned" });
      }

      try {
        await tx.zeradsCallback.create({
          data: {
            userId,
            username: user.username || `user_${userId}`,
            amountZer: amountNum,
            exchangeRate: ZERADS_EXCHANGE,
            payoutAmount: payoutFloat,
            clicks: clicksParsed,
            requestIp,
            callbackHash,
            callbackAt: now
          }
        });
      } catch (e) {
        if (e && e.code === "P2002") {
          duplicate = true;
          return;
        }
        throw e;
      }

      await tx.user.update({
        where: { id: userId },
        data: { polBalance: { increment: payoutDec } }
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "zerads_ptc",
          ip: requestIp,
          detailsJson: JSON.stringify({
            externalUser: String(externalUser),
            amountZer: amountNum,
            payoutAmount: payoutFloat,
            clicks: clicksParsed,
            exchangeRate: ZERADS_EXCHANGE,
            duplicate: false
          })
        }
      });
      credited = true;
    });

    if (duplicate) {
      logger.info("ZerAds callback deduplicated", { userId, callbackHash: callbackHash.slice(0, 16) });
      return res.status(200).send("ok");
    }

    if (credited) {
      try {
        const { applyUserBalanceDelta } = await import("../src/runtime/miningRuntime.js");
        applyUserBalanceDelta(userId, payoutFloat);
      } catch (err) {
        logger.error("ZerAds mining runtime sync failed", { err: err?.message });
      }
      try {
        const engine = getMiningEngine();
        await createNotification({
          userId,
          title: "ZerAds PTC reward",
          message: `+${payoutFloat.toFixed(4)} ${ZERADS_REWARD_NAME} credited from partner ads.`,
          type: "reward",
          io: engine?.io ?? null
        });
      } catch (notifyErr) {
        logger.warn("ZerAds reward notification failed", { userId, message: notifyErr?.message });
      }
    }

    return res.status(200).send("ok");
  } catch (error) {
    if (error && error.code === "user_not_found") return res.status(400).send("invalid_user");
    if (error && error.code === "user_banned") return res.status(403).send("forbidden");
    logger.error("ZerAds callback error", { error: error.message });
    return res.status(500).send("error");
  }
}

export async function getStats(req, res) {
  try {
    const userId = req.user.id;
    const [totalClaims, sumRow, recentRows] = await Promise.all([
      prisma.zeradsCallback.count({ where: { userId } }),
      prisma.zeradsCallback.aggregate({
        where: { userId },
        _sum: { payoutAmount: true }
      }),
      prisma.zeradsCallback.findMany({
        where: { userId },
        orderBy: { callbackAt: "desc" },
        take: 15
      })
    ]);

    const totalEarned = sumRow._sum.payoutAmount != null ? Number(sumRow._sum.payoutAmount) : 0;
    const recent = recentRows.map((r) => ({
      createdAt: r.callbackAt.toISOString(),
      detailsJson: JSON.stringify({
        payoutAmount: r.payoutAmount,
        amountZer: r.amountZer,
        clicks: r.clicks,
        exchangeRate: r.exchangeRate
      })
    }));

    res.json({
      ok: true,
      stats: {
        totalClaims,
        totalEarned,
        rewardName: ZERADS_REWARD_NAME,
        exchangeRate: ZERADS_EXCHANGE,
        recent,
        clientOrigin: resolveRequestPublicOrigin(req)
      }
    });
  } catch {
    res.status(500).json({ ok: false, message: "Error fetching stats." });
  }
}

export async function getOfferwallLink(req, res) {
  try {
    const userId = req.user.id;
    const externalUser = `u${userId}_${crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 8)}`;
    const offerwallUrl = `https://zerads.com/offerwall.php?ref=${ZERADS_SITE_ID}&user=${encodeURIComponent(externalUser)}`;
    res.json({ ok: true, offerwallUrl });
  } catch {
    res.status(500).json({ ok: false, message: "Error generating offerwall link." });
  }
}
