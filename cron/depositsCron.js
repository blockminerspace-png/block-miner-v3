const { ethers } = require("ethers");
const walletModel = require("../models/walletModel");
const logger = require("../utils/logger").child("DepositsCron");
const { createCronActionRunner } = require("./cronActionRunner");
const cron = require('node-cron');
const config = require('../src/config');

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://poly.api.pocket.network";
const POLYGON_RPC_TIMEOUT_MS = Number(process.env.POLYGON_RPC_TIMEOUT_MS || 4500);
const DEFAULT_RPC_URLS = [
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.drpc.org",
  "https://poly.api.pocket.network",
  "https://1rpc.io/matic",
  "https://polygon.blockpi.network/v1/rpc/public",
  "https://polygon.meowrpc.com",
  "https://polygon-mainnet.public.blastapi.io",
  "https://rpc-mainnet.matic.network"
];
const RPC_URLS = Array.from(new Set([POLYGON_RPC_URL, ...DEFAULT_RPC_URLS]));
const CHECKIN_RECEIVER = process.env.CHECKIN_RECEIVER || "0x95EA8E99063A3EF1B95302aA1C5bE199653EEb13";

let currentProviderIndex = 0;
const runCronAction = createCronActionRunner({ logger, cronName: "DepositsCron" });

function createProvider(url) {
  const request = new ethers.FetchRequest(url);
  request.timeout = POLYGON_RPC_TIMEOUT_MS;
  return new ethers.JsonRpcProvider(request);
}

async function getProvider() {
  const maxAttempts = RPC_URLS.length;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const url = RPC_URLS[currentProviderIndex];
      const provider = createProvider(url);
      await provider.getBlockNumber();
      return provider;
    } catch (error) {
      logger.warn("RPC failed, trying next", { url: RPC_URLS[currentProviderIndex], error: error.message });
      currentProviderIndex = (currentProviderIndex + 1) % RPC_URLS.length;
    }
  }
  
  throw new Error("All RPC endpoints failed");
}

function isSameAddress(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

async function getConfirmations(provider, receipt) {
  if (!receipt?.blockNumber || !provider) {
    return 0;
  }

  const latestBlock = await provider.getBlockNumber();
  return Math.max(0, latestBlock - receipt.blockNumber + 1);
}

async function checkPendingDeposits() {
  await runCronAction({
    action: "check_pending_deposits_batch",
    meta: { trigger: "scheduler" },
    prepare: async () => ({ pendingDeposits: await walletModel.getPendingDeposits("__all__") }),
    validate: async ({ pendingDeposits }) => {
      if (!Array.isArray(pendingDeposits)) {
        return { ok: false, reason: "invalid_pending_deposits_payload" };
      }

      if (pendingDeposits.length === 0) {
        return { ok: false, reason: "no_pending_deposits", details: { count: 0 } };
      }

      return { ok: true, details: { count: pendingDeposits.length } };
    },
    sanitize: async ({ pendingDeposits }) => ({
      pendingDeposits: pendingDeposits.filter((deposit) => Boolean(deposit?.id && deposit?.user_id && deposit?.tx_hash))
    }),
    execute: async ({ pendingDeposits }) => {
      logger.info("Checking pending deposits", { count: pendingDeposits.length });

      let processedCount = 0;
      let completedCount = 0;
      let invalidCount = 0;
      let skippedCount = 0;

      for (const deposit of pendingDeposits) {
        const result = await runCronAction({
          action: "process_pending_deposit",
          allowConcurrent: true,
          logStart: false,
          logSuccess: false,
          meta: {
            depositId: deposit.id,
            userId: deposit.user_id,
            txHash: deposit.tx_hash
          },
          prepare: async () => {
            const provider = await getProvider();
            const [tx, receipt] = await Promise.all([
              provider.getTransaction(deposit.tx_hash),
              provider.getTransactionReceipt(deposit.tx_hash)
            ]);

            const confirmations = await getConfirmations(provider, receipt);
            return { deposit, tx, receipt, confirmations };
          },
          validate: async ({ tx, receipt, confirmations }) => {
            if (!tx || !receipt) {
              return { ok: false, reason: "tx_or_receipt_not_found" };
            }

            if (receipt.status !== 1) {
              return { ok: false, reason: "receipt_status_not_success", details: { receiptStatus: receipt.status } };
            }

            if (confirmations < 1) {
              return { ok: false, reason: "insufficient_confirmations", details: { confirmations } };
            }

            return { ok: true };
          },
          sanitize: async ({ deposit, tx }) => {
            const actualAmount = Number(Number(ethers.formatEther(tx.value || 0)).toFixed(6));
            return {
              deposit,
              toAddress: String(tx.to || "").trim(),
              actualAmount
            };
          },
          execute: async ({ deposit: safeDeposit, toAddress, actualAmount }) => {
            if (!isSameAddress(toAddress, CHECKIN_RECEIVER)) {
              await walletModel.updateDepositStatus(safeDeposit.id, "invalid");
              return { status: "invalid", reason: "destination_mismatch" };
            }

            if (!actualAmount || actualAmount <= 0) {
              await walletModel.updateDepositStatus(safeDeposit.id, "invalid");
              return { status: "invalid", reason: "invalid_amount" };
            }

            await walletModel.creditBalance(safeDeposit.user_id, actualAmount);
            await walletModel.updateDepositStatus(safeDeposit.id, "completed", actualAmount);
            return { status: "completed", amountPol: actualAmount };
          },
          confirm: async ({ executionResult }) => {
            if (executionResult?.status === "completed") {
              return {
                ok: true,
                details: {
                  status: executionResult.status,
                  amountPol: executionResult.amountPol
                }
              };
            }

            if (executionResult?.status === "invalid") {
              return {
                ok: false,
                reason: executionResult.reason || "deposit_marked_invalid",
                details: { status: executionResult.status }
              };
            }

            return { ok: false, reason: "unexpected_execution_result" };
          }
        });

        processedCount += 1;

        if (result.ok) {
          completedCount += 1;
          continue;
        }

        if (result.reason === "destination_mismatch" || result.reason === "invalid_amount") {
          invalidCount += 1;
        } else {
          skippedCount += 1;
        }
      }

      return {
        total: pendingDeposits.length,
        processedCount,
        completedCount,
        invalidCount,
        skippedCount
      };
    },
    confirm: async ({ executionResult }) => ({
      ok: executionResult.processedCount >= 0,
      details: executionResult
    })
  });
}

function startDepositMonitoring() {
  // If a cron expression is provided in config, use it (supports seconds field)
  const cronExpr = config?.schedules?.depositsCron;
  if (cronExpr) {
    try {
      const task = cron.schedule(cronExpr, () => {
        checkPendingDeposits().catch(err => logger.error('Deposit check failed', { error: err.message }));
      }, { scheduled: true });

      // Run once on startup
      checkPendingDeposits();

      logger.info('Deposit monitoring started (cron)', { cron: cronExpr });
      return { depositCronTask: task };
    } catch (error) {
      logger.error('Invalid deposit cron expression, falling back to interval', { cronExpr, error: error.message });
    }
  }

  // Fallback: Check pending deposits every 30 seconds
  const interval = setInterval(checkPendingDeposits, 30000);
  checkPendingDeposits();
  logger.info('Deposit monitoring started', { intervalMs: 30000 });
  return { depositMonitoringInterval: interval };
}

module.exports = {
  startDepositMonitoring,
  checkPendingDeposits
};
