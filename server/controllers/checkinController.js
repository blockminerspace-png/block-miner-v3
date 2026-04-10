import crypto from "crypto";
import prisma from "../src/db/prisma.js";
import { getBrazilCheckinDateKey } from "../utils/checkinDate.js";
import { computeCheckinStreak } from "../utils/checkinStreak.js";
import { assertValidTxHash, evaluateCheckinTx, normalizeAddr, parseCheckinAmountWei } from "../services/checkinChain.js";
import {
  applyStreakMilestoneRewards,
  buildMilestoneStatusForUser
} from "../services/checkinMilestoneService.js";

const POLYGON_CHAIN_ID = Number(process.env.POLYGON_CHAIN_ID || 137);
const ZERO = "0x0000000000000000000000000000000000000000";

/** Deterministic placeholder tx hash for payment-free check-ins (unique per user + calendar day). */
export function syntheticFreeTxHash(userId, checkinDate) {
  const h = crypto.createHash("sha256").update(`bm-free-checkin|${userId}|${checkinDate}`).digest("hex");
  return `0x${h}`;
}

function isFreeSyntheticTx(txHash, userId, checkinDate) {
  if (!txHash || typeof txHash !== "string") return false;
  return txHash === syntheticFreeTxHash(userId, checkinDate);
}

function getReceiver() {
  return (process.env.CHECKIN_RECEIVER || "").trim();
}

function paymentCheckinEnabled() {
  const r = getReceiver();
  return Boolean(r && r.toLowerCase() !== ZERO);
}

async function getTodayRow(userId) {
  const today = getBrazilCheckinDateKey();
  return prisma.dailyCheckin.findUnique({
    where: { userId_checkinDate: { userId, checkinDate: today } }
  });
}

async function loadRecentHistory(userId, take = 21) {
  const rows = await prisma.dailyCheckin.findMany({
    where: { userId, status: "confirmed" },
    orderBy: { checkinDate: "desc" },
    take,
    select: { checkinDate: true, confirmedAt: true }
  });
  return rows.map((r) => ({
    date: r.checkinDate,
    confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null
  }));
}

/**
 * Confirms or fails a pending row using on-chain data (legacy payment check-ins only).
 */
export async function tryFinalizeCheckinRow(row) {
  if (!row || row.status !== "pending") return row;
  if (isFreeSyntheticTx(row.txHash, row.userId, row.checkinDate)) return row;

  const wallet =
    row.user?.walletAddress ||
    (await prisma.user.findUnique({ where: { id: row.userId }, select: { walletAddress: true } }))?.walletAddress;
  if (!wallet) return row;

  const receiver = getReceiver();
  if (!receiver || receiver.toLowerCase() === ZERO) return row;

  const minWei = parseCheckinAmountWei();
  let ev;
  try {
    ev = await evaluateCheckinTx({
      txHash: row.txHash,
      userWalletLower: normalizeAddr(wallet),
      receiverLower: normalizeAddr(receiver),
      minValueWei: minWei
    });
  } catch {
    return row;
  }

  if (ev.state === "confirmed") {
    const updated = await prisma.dailyCheckin.update({
      where: { id: row.id },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
        amount: Number(minWei) / 1e18,
        chainId: POLYGON_CHAIN_ID
      }
    });
    applyStreakMilestoneRewards(updated.userId).catch(() => {});
    return updated;
  }

  if (ev.state === "failed") {
    return prisma.dailyCheckin.update({
      where: { id: row.id },
      data: { status: "failed" }
    });
  }

  return row;
}

export async function tryFinalizeTodayCheckin(userId, walletAddress) {
  const row = await getTodayRow(userId);
  if (!row || row.status !== "pending" || !walletAddress) return row;
  return tryFinalizeCheckinRow({ ...row, user: { walletAddress: walletAddress } });
}

export async function processStalePendingCheckins({ batchSize = 40 } = {}) {
  const since = new Date(Date.now() - 72 * 3600000);
  const pending = await prisma.dailyCheckin.findMany({
    where: { status: "pending", createdAt: { gte: since } },
    take: batchSize,
    orderBy: { createdAt: "asc" },
    include: { user: { select: { walletAddress: true } } }
  });

  for (const row of pending) {
    if (isFreeSyntheticTx(row.txHash, row.userId, row.checkinDate)) continue;
    await tryFinalizeCheckinRow(row).catch(() => {});
  }
}

export async function getStatus(req, res) {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true, polBalance: true }
    });
    const wallet = user?.walletAddress || null;
    const polBalance = user?.polBalance != null ? Number(user.polBalance) : 0;
    const pay = paymentCheckinEnabled();
    const minWei = parseCheckinAmountWei();

    let row = null;
    let streak = 0;
    let recentCheckins = [];
    let totalConfirmed = 0;
    let milestones = [];
    let statusDegraded = false;

    try {
      if (pay) {
        await tryFinalizeTodayCheckin(userId, wallet);
      }
      row = await getTodayRow(userId);
      streak = await computeCheckinStreak(userId);
      [recentCheckins, totalConfirmed, milestones] = await Promise.all([
        loadRecentHistory(userId, 21),
        prisma.dailyCheckin.count({ where: { userId, status: "confirmed" } }),
        buildMilestoneStatusForUser(userId, streak).catch((err) => {
          console.error("checkin getStatus: milestones unavailable", err?.message);
          return [];
        })
      ]);
    } catch (dbErr) {
      statusDegraded = true;
      console.error("checkin getStatus: daily_checkins / milestones DB error", dbErr?.message || dbErr);
    }

    res.json({
      ok: true,
      statusDegraded,
      checkedIn: statusDegraded ? false : row?.status === "confirmed",
      pending: statusDegraded ? false : row?.status === "pending" && !isFreeSyntheticTx(row?.txHash, userId, row?.checkinDate),
      failed: statusDegraded ? false : row?.status === "failed",
      status: statusDegraded ? null : row?.status || null,
      txHash: statusDegraded ? null : row?.txHash || null,
      streak: statusDegraded ? 0 : streak,
      totalConfirmed: statusDegraded ? 0 : totalConfirmed,
      recentCheckins: statusDegraded ? [] : recentCheckins,
      walletLinked: Boolean(wallet),
      paymentRequired: pay,
      checkinReceiver: pay ? getReceiver() : null,
      checkinAmountWei: pay ? minWei.toString() : "0",
      chainId: POLYGON_CHAIN_ID,
      rpcConfigured: pay && Boolean(process.env.AETHER_RPC_URL?.trim() || process.env.POLYGON_RPC_URL?.trim()),
      milestones: statusDegraded ? [] : milestones,
      polBalance: statusDegraded ? 0 : polBalance
    });
  } catch (e) {
    console.error("Checkin getStatus:", e);
    res.status(500).json({ ok: false, message: "Unable to load check-in status." });
  }
}

/**
 * Free daily check-in: one confirmed row per user per calendar day (America/Sao_Paulo).
 * Persists in DB — streak and history survive new days and new sessions.
 */
export async function claimCheckin(req, res) {
  try {
    const userId = req.user.id;
    const today = getBrazilCheckinDateKey();
    const txHash = syntheticFreeTxHash(userId, today);

    const existing = await prisma.dailyCheckin.findUnique({
      where: { userId_checkinDate: { userId, checkinDate: today } }
    });

    if (existing?.status === "confirmed") {
      const streak = await computeCheckinStreak(userId);
      const recentCheckins = await loadRecentHistory(userId, 21);
      return res.json({
        ok: true,
        alreadyCheckedIn: true,
        status: "confirmed",
        streak,
        recentCheckins
      });
    }

    await prisma.dailyCheckin.upsert({
      where: { userId_checkinDate: { userId, checkinDate: today } },
      create: {
        userId,
        checkinDate: today,
        txHash,
        status: "confirmed",
        confirmedAt: new Date(),
        amount: 0,
        chainId: POLYGON_CHAIN_ID
      },
      update: {
        txHash,
        status: "confirmed",
        confirmedAt: new Date(),
        amount: 0,
        chainId: POLYGON_CHAIN_ID
      }
    });

    await applyStreakMilestoneRewards(userId);

    const streak = await computeCheckinStreak(userId);
    const recentCheckins = await loadRecentHistory(userId, 21);

    return res.json({
      ok: true,
      status: "confirmed",
      streak,
      recentCheckins
    });
  } catch (error) {
    console.error("Checkin claim error:", error);
    res.status(500).json({ ok: false, message: "Unable to register check-in." });
  }
}

/** Legacy blockchain check-in (only if CHECKIN_RECEIVER is set). */
export async function confirmCheckin(req, res) {
  try {
    if (!paymentCheckinEnabled()) {
      return res.status(400).json({
        ok: false,
        message: "Pagamento on-chain desativado. Usa o botão de check-in diário (sem POL)."
      });
    }

    const receiver = getReceiver();
    const minWei = parseCheckinAmountWei();
    let txHash;
    try {
      txHash = assertValidTxHash(req.body?.txHash);
    } catch (e) {
      return res.status(400).json({ ok: false, message: e.message || "Invalid transaction hash." });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { walletAddress: true }
    });
    const wallet = user?.walletAddress?.trim();
    if (!wallet) {
      return res.status(400).json({
        ok: false,
        message: "Link and verify your wallet in the Wallet page before check-in."
      });
    }
    const userWalletLower = normalizeAddr(wallet);

    const today = getBrazilCheckinDateKey();
    const existing = await prisma.dailyCheckin.findUnique({
      where: { userId_checkinDate: { userId: req.user.id, checkinDate: today } }
    });

    if (existing?.status === "confirmed") {
      return res.json({ ok: true, alreadyCheckedIn: true, status: "confirmed" });
    }

    const dup = await prisma.dailyCheckin.findUnique({ where: { txHash } });
    if (dup && dup.userId !== req.user.id) {
      return res.status(400).json({ ok: false, message: "This transaction is already used by another account." });
    }
    if (dup && dup.userId === req.user.id && dup.checkinDate !== today) {
      return res.status(400).json({
        ok: false,
        message: "This transaction was already used for a previous check-in day."
      });
    }

    if (existing?.status === "pending" || existing?.status === "failed") {
      await prisma.dailyCheckin.update({
        where: { id: existing.id },
        data: { txHash, status: "pending", confirmedAt: null }
      });
    } else if (!existing) {
      await prisma.dailyCheckin.create({
        data: {
          userId: req.user.id,
          checkinDate: today,
          txHash,
          status: "pending",
          chainId: POLYGON_CHAIN_ID,
          amount: Number(minWei) / 1e18
        }
      });
    }

    let ev;
    try {
      ev = await evaluateCheckinTx({
        txHash,
        userWalletLower,
        receiverLower: normalizeAddr(receiver),
        minValueWei: minWei
      });
    } catch (e) {
      console.error("Checkin RPC error:", e.message);
      return res.json({
        ok: true,
        pending: true,
        message: "Blockchain temporarily unavailable. Your check-in is saved; refresh in a moment."
      });
    }

    if (ev.state === "pending") {
      return res.json({
        ok: true,
        pending: true,
        message: "Transaction received. Waiting for blockchain confirmation — you can leave this page; open Check-in again later."
      });
    }

    if (ev.state === "failed") {
      await prisma.dailyCheckin.updateMany({
        where: { userId: req.user.id, checkinDate: today },
        data: { status: "failed" }
      });
      return res.status(400).json({ ok: false, message: ev.reason || "Invalid transaction." });
    }

    const updated = await prisma.dailyCheckin.update({
      where: { userId_checkinDate: { userId: req.user.id, checkinDate: today } },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
        amount: Number(minWei) / 1e18,
        chainId: POLYGON_CHAIN_ID
      }
    });

    await applyStreakMilestoneRewards(req.user.id);

    return res.json({ ok: true, status: "confirmed", txHash: updated.txHash });
  } catch (error) {
    console.error("Checkin error:", error);
    res.status(500).json({ ok: false, message: "Unable to verify check-in." });
  }
}

/**
 * Wallet-based check-in: Pay 0.01 POL via blockchain.
 */
export async function checkinWallet(req, res) {
  try {
    const userId = req.user.id;
    const { txHash } = req.body;

    if (!txHash || typeof txHash !== "string") {
      return res.status(400).json({ ok: false, message: "Invalid transaction hash." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true }
    });

    if (!user?.walletAddress) {
      return res.status(400).json({ ok: false, message: "Wallet not linked." });
    }

    const today = getBrazilCheckinDateKey();
    const existing = await prisma.dailyCheckin.findUnique({
      where: { userId_checkinDate: { userId, checkinDate: today } }
    });

    if (existing?.status === "confirmed") {
      return res.json({ ok: false, message: "Already checked in today." });
    }

    // Create pending row
    const row = await prisma.dailyCheckin.upsert({
      where: { userId_checkinDate: { userId, checkinDate: today } },
      update: {
        txHash,
        status: "pending",
        paymentMethod: "wallet",
        amount: 0.01,
        chainId: POLYGON_CHAIN_ID
      },
      create: {
        userId,
        checkinDate: today,
        txHash,
        status: "pending",
        paymentMethod: "wallet",
        amount: 0.01,
        chainId: POLYGON_CHAIN_ID
      }
    });

    // Try to finalize immediately
    const finalized = await tryFinalizeCheckinRow({ ...row, user });

    if (finalized.status === "confirmed") {
      const streak = await computeCheckinStreak(userId);
      return res.json({
        ok: true,
        message: "Check-in confirmed via wallet.",
        streak,
        txHash: finalized.txHash
      });
    } else {
      return res.json({
        ok: true,
        message: "Check-in pending confirmation.",
        txHash: row.txHash
      });
    }
  } catch (e) {
    console.error("Checkin wallet error", { error: e.message, userId: req.user.id });
    res.status(500).json({ ok: false, message: "Wallet check-in failed." });
  }
}

/**
 * Balance-based check-in: Deduct 0.02 POL from internal balance.
 */
export async function checkinBalance(req, res) {
  try {
    const userId = req.user.id;
    const amount = 0.02;
    const today = getBrazilCheckinDateKey();
    const balanceTxHash = `balance-${userId}-${today}`;
    const existing = await prisma.dailyCheckin.findUnique({
      where: { userId_checkinDate: { userId, checkinDate: today } }
    });

    if (existing?.status === "confirmed") {
      return res.status(400).json({
        ok: false,
        code: "CHECKIN_ALREADY_TODAY",
        message: "Already checked in today."
      });
    }

    // Atomic deduction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { polBalance: true }
      });

      const bal = user ? Number(user.polBalance) : 0;
      if (!user || !(bal >= amount)) {
        throw new Error("Insufficient POL balance.");
      }

      await tx.user.update({
        where: { id: userId },
        data: { polBalance: { decrement: amount } }
      });

      const row = await tx.dailyCheckin.upsert({
        where: { userId_checkinDate: { userId, checkinDate: today } },
        update: {
          status: "confirmed",
          confirmedAt: new Date(),
          paymentMethod: "balance",
          amount,
          txHash: balanceTxHash
        },
        create: {
          userId,
          checkinDate: today,
          txHash: balanceTxHash,
          status: "confirmed",
          confirmedAt: new Date(),
          paymentMethod: "balance",
          amount
        }
      });

      return row;
    });

    await applyStreakMilestoneRewards(userId);
    const streak = await computeCheckinStreak(userId);

    const userAfter = await prisma.user.findUnique({
      where: { id: userId },
      select: { polBalance: true }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: "daily_checkin_balance",
        detailsJson: JSON.stringify({ amount, streak }),
        userAgent: req.get("User-Agent") || null
      }
    });

    res.json({
      ok: true,
      message: "Check-in confirmed via balance.",
      streak,
      txHash: result.txHash,
      newBalance: userAfter ? Number(userAfter.polBalance) : undefined
    });
  } catch (e) {
    console.error("Checkin balance error", { error: e.message, userId: req.user.id });
    if (e.message === "Insufficient POL balance.") {
      return res.status(400).json({
        ok: false,
        code: "CHECKIN_BALANCE_INSUFFICIENT",
        message: "Insufficient POL balance."
      });
    }
    res.status(500).json({
      ok: false,
      code: "CHECKIN_BALANCE_FAILED",
      message: "Balance check-in failed."
    });
  }
}
