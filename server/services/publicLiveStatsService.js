import prisma from "../src/db/prisma.js";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Safe aggregates for OBS / public live pages (no wallet addresses, no user PII).
 */
export async function getPublicLiveStats() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    polUserBalances,
    depositsAll,
    withdrawalsAll,
    deposits24h,
    withdrawals24h,
    pendingWithdrawals,
    newUsers24h,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.aggregate({ _sum: { polBalance: true } }),
    prisma.transaction.aggregate({
      where: { type: "deposit", status: "completed" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "withdrawal", status: "completed" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "deposit", status: "completed", createdAt: { gte: dayAgo } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "withdrawal", status: "completed", createdAt: { gte: dayAgo } },
      _sum: { amount: true },
    }),
    Promise.all([
      prisma.transaction.count({
        where: { type: "withdrawal", status: { in: ["pending", "approved"] } },
      }),
      prisma.transaction.aggregate({
        where: { type: "withdrawal", status: { in: ["pending", "approved"] } },
        _sum: { amount: true },
      }),
    ]),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    usersTotal,
    newUsers24h,
    polInUserBalances: num(polUserBalances._sum.polBalance),
    polDepositedTotal: num(depositsAll._sum.amount),
    polWithdrawnTotal: num(withdrawalsAll._sum.amount),
    polDeposited24h: num(deposits24h._sum.amount),
    polWithdrawn24h: num(withdrawals24h._sum.amount),
    pendingWithdrawalsCount: pendingWithdrawals[0] ?? 0,
    pendingWithdrawalsPol: num(pendingWithdrawals[1]._sum.amount),
  };
}
