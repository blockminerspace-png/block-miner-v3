import crypto from "crypto";
import prisma from "../src/db/prisma.js";
import loggerLib from "../utils/logger.js";
import {
  assertZerAdsCallbackAuthorized,
  getZerAdsSecretFromEnv,
  isStrongZerAdsSecret,
  parseIpAllowlist,
  isRequestIpAllowlisted,
  zeradsInsecureCallbacksAllowed
} from "../utils/zeradsCallbackSecurity.js";

const logger = loggerLib.child("ZerAdsController");
const ZERADS_SITE_ID = process.env.ZERADS_SITE_ID || "10776";
const ZERADS_PTC_EXCHANGE_RATE = Number(process.env.ZERADS_PTC_EXCHANGE_RATE) || 0.0001;
const ZERADS_ALLOWED_IPS = parseIpAllowlist(process.env.ZERADS_ALLOWED_IPS || "");

export async function getPtcLink(req, res) {
  try {
    const userId = req.user.id;
    const externalUser = `u${userId}_${crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 8)}`;
    const ptcUrl = `https://zerads.com/ptc.php?ref=${ZERADS_SITE_ID}&user=${externalUser}`;
    res.json({ ok: true, ptcUrl, externalUser });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Error generating link." });
  }
}

export async function handlePtcCallback(req, res) {
  try {
    const payload = Object.keys(req.body || {}).length > 0 ? req.body : req.query;
    const { user: externalUser, amount, clicks, secret: providedSecret } = payload;

    if (!externalUser || amount == null || amount === "") {
      return res.status(400).send("missing_params");
    }

    if (!isRequestIpAllowlisted(req, ZERADS_ALLOWED_IPS)) {
      logger.warn("ZerAds callback rejected: IP not in allowlist", { ip: req.ip });
      return res.status(403).send("unauthorized");
    }

    const configuredSecret = getZerAdsSecretFromEnv();
    const auth = assertZerAdsCallbackAuthorized({
      configuredSecret,
      providedSecret
    });
    if (!auth.ok) {
      if (auth.status === 403) {
        logger.warn("ZerAds callback rejected: invalid secret", { externalUser: String(externalUser).slice(0, 32) });
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

    const userIdMatch = String(externalUser).match(/^u(\d+)_/);
    if (!userIdMatch) return res.status(400).send("invalid_user");

    const userId = parseInt(userIdMatch[1], 10);
    const amountNum = Number(amount);
    const payoutAmount = amountNum * ZERADS_PTC_EXCHANGE_RATE;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { usdcBalance: { increment: payoutAmount } }
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "zerads_ptc",
          details: { externalUser, amountZer: amountNum, payoutAmount, clicks }
        }
      });
    });

    res.send("ok");
  } catch (error) {
    logger.error("ZerAds callback error", { error: error.message });
    res.status(500).send("error");
  }
}

export async function getStats(req, res) {
  try {
    const userId = req.user.id;
    const logs = await prisma.auditLog.findMany({
      where: { userId, action: "zerads_ptc" },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    res.json({ ok: true, stats: { totalClicks: logs.length, recent: logs } });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Error fetching stats." });
  }
}

export async function getOfferwallLink(req, res) {
  try {
    const userId = req.user.id;
    const externalUser = `u${userId}_${crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 8)}`;
    const offerwallUrl = `https://zerads.com/offerwall.php?ref=${ZERADS_SITE_ID}&user=${externalUser}`;
    res.json({ ok: true, offerwallUrl });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Error generating offerwall link." });
  }
}
