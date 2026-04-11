import prisma from "../src/db/prisma.js";
import loggerNamespace from "../utils/logger.js";
import { verifyOfferwallMeSignature } from "../utils/offerwallPostbackSecurity.js";

const logger = loggerNamespace.child("OfferwallController");

function envFlag(name) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function offerwallUnsignedAllowed() {
  if (process.env.NODE_ENV === "production") return false;
  return envFlag("OFFERWALL_ALLOW_UNSIGNED_CALLBACKS");
}

/**
 * Redacted postback log line (no full body/query/headers).
 * @param {import("express").Request} req
 * @param {Record<string, unknown>} fields
 */
function logPostbackMeta(req, fields) {
  logger.info("Offerwall.me postback", {
    method: req.method,
    path: req.path,
    ...fields
  });
}

export async function offerwallMePostback(req, res) {
  try {
    const data = Object.keys(req.body || {}).length > 0 ? req.body : req.query;

    const userIdRaw = data.subId;
    const txId = data.transId;
    const amountRaw = data.reward;
    const userIp = data.userIp || req.headers["x-forwarded-for"] || req.ip;
    const statusRaw = String(data.status);
    const isDebug = String(data.debug) === "1";
    const signature = data.signature;

    if (!userIdRaw || amountRaw == null || amountRaw === "" || !txId) {
      logPostbackMeta(req, { result: "missing_params" });
      return res.status(400).send("Missing parameters");
    }

    const userId = parseInt(String(userIdRaw), 10);
    const amount = parseFloat(String(amountRaw));

    if (Number.isNaN(userId) || Number.isNaN(amount)) {
      return res.status(400).send("Invalid userId or amount");
    }

    const secretKey = String(process.env.OFFERWALL_ME_SECRET || "").trim();
    const secretConfigured = secretKey.length > 0;

    if (isDebug) {
      if (secretConfigured) {
        const sigOk = verifyOfferwallMeSignature(userIdRaw, txId, amountRaw, secretKey, signature);
        if (!sigOk) {
          logger.warn("Offerwall.me debug postback: bad signature", { transId: String(txId).slice(0, 24) });
          return res.status(403).send("unauthorized");
        }
      } else if (!offerwallUnsignedAllowed()) {
        logger.warn("Offerwall.me debug postback rejected: OFFERWALL_ME_SECRET not set");
        return res.status(503).send("unconfigured");
      }
      logPostbackMeta(req, { result: "debug_ok", userId, transId: String(txId).slice(0, 24) });
      return res.status(200).send("OK");
    }

    if (!secretConfigured) {
      if (process.env.NODE_ENV === "production") {
        logger.error("Offerwall.me live postback rejected: OFFERWALL_ME_SECRET missing");
        return res.status(503).send("unconfigured");
      }
      if (!offerwallUnsignedAllowed()) {
        logger.warn("Offerwall.me postback rejected: OFFERWALL_ME_SECRET missing (set OFFERWALL_ALLOW_UNSIGNED_CALLBACKS=1 for local dev only)");
        return res.status(503).send("unconfigured");
      }
    } else {
      const sigOk = verifyOfferwallMeSignature(userIdRaw, txId, amountRaw, secretKey, signature);
      if (!sigOk) {
        logger.warn("Offerwall.me postback: invalid signature", {
          userId,
          transId: String(txId).slice(0, 24)
        });
        return res.status(403).send("unauthorized");
      }
    }

    const isChargeback =
      statusRaw === "2" ||
      statusRaw === "chargeback" ||
      statusRaw === "revoke" ||
      statusRaw === "reversed";

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).send("User not found");
    }

    let miningEngineDelta = 0;

    await prisma.$transaction(async (tx) => {
      const existingCb = await tx.offerwallCallback.findUnique({
        where: { transactionId: String(txId) }
      });

      if (existingCb) {
        if (existingCb.status === "completed" && isChargeback) {
          await tx.user.update({
            where: { id: userId },
            data: { polBalance: { decrement: amount } }
          });

          await tx.offerwallCallback.update({
            where: { id: existingCb.id },
            data: { status: "chargeback" }
          });

          await tx.auditLog.create({
            data: {
              user: { connect: { id: userId } },
              action: "OFFERWALL_CHARGEBACK",
              detailsJson: JSON.stringify({ provider: "offerwall.me", txId, amount }),
              ip: String(userIp || "")
            }
          });
          miningEngineDelta = -amount;
        }
        return;
      }

      if (!isChargeback) {
        await tx.offerwallCallback.create({
          data: {
            user: { connect: { id: userId } },
            provider: "offerwall.me",
            transactionId: String(txId),
            amount,
            status: "completed",
            requestIp: String(userIp || ""),
          }
        });

        await tx.user.update({
          where: { id: userId },
          data: { polBalance: { increment: amount } }
        });

        await tx.auditLog.create({
          data: {
            user: { connect: { id: userId } },
            action: "OFFERWALL_CREDIT",
            detailsJson: JSON.stringify({ provider: "offerwall.me", txId, amount }),
            ip: String(userIp || "")
          }
        });

        await tx.notification.create({
          data: {
            user: { connect: { id: userId } },
            title: "Offerwall reward",
            message: `You received ${amount} POL from Offerwall.me.`,
            type: "reward"
          }
        });
        miningEngineDelta = amount;
      }
    });

    if (miningEngineDelta !== 0) {
      import("../src/runtime/miningRuntime.js")
        .then(({ applyUserBalanceDelta }) => {
          applyUserBalanceDelta(userId, miningEngineDelta);
        })
        .catch((e) => logger.error("Failed to sync offerwall balance to engine", e));
    }

    logPostbackMeta(req, { result: "ok", userId, transId: String(txId).slice(0, 24) });
    return res.status(200).send("OK");
  } catch (error) {
    logger.error("Error processing offerwall.me postback", { error: error.message });
    return res.status(500).send("Internal Server Error");
  }
}
