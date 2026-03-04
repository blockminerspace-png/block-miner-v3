const { get, all, run } = require("../models/db");
const logger = require("../utils/logger").child("CallbackQueueCron");
const { processQueuedCallback } = require("../controllers/zeradsController");
const { createCronActionRunner } = require("./cronActionRunner");

const QUEUE_PROCESS_INTERVAL = 1000; // Process every 1 second
const QUEUE_BATCH_SIZE = 10; // Process max 10 items at a time

function startCallbackQueueProcessing() {
  const runCronAction = createCronActionRunner({ logger, cronName: "CallbackQueueCron" });
  const timers = [];

  const processQueue = async () => {
    await runCronAction({
      action: "process_callback_queue_batch",
      logStart: false,
      validateFailureLogLevel: "debug",
      skippedLogLevel: "debug",
      prepare: async () => ({
        pendingCallbacks: await all(
          `
            SELECT id, user_id, callback_hash
            FROM callback_queue
            WHERE status = 'pending'
              AND (next_retry_at IS NULL OR next_retry_at <= ?)
            ORDER BY created_at ASC
            LIMIT ?
          `,
          [Date.now(), QUEUE_BATCH_SIZE]
        )
      }),
      validate: async ({ pendingCallbacks }) => {
        if (!Array.isArray(pendingCallbacks)) {
          return { ok: false, reason: "invalid_pending_callbacks_payload" };
        }

        if (pendingCallbacks.length === 0) {
          return { ok: false, reason: "empty_queue" };
        }

        return { ok: true, details: { count: pendingCallbacks.length } };
      },
      sanitize: async ({ pendingCallbacks }) => ({
        pendingCallbacks: pendingCallbacks.filter((callback) =>
          Boolean(callback?.id && callback?.user_id && callback?.callback_hash)
        )
      }),
      execute: async ({ pendingCallbacks }) => {
        logger.debug(`Processing ${pendingCallbacks.length} queued callbacks`);

        let successCount = 0;
        let failCount = 0;

        for (const callback of pendingCallbacks) {
          const callbackResult = await runCronAction({
            action: "process_single_callback",
            allowConcurrent: true,
            logStart: false,
            logSuccess: false,
            meta: {
              callbackId: callback.id,
              userId: callback.user_id,
              callbackHash: callback.callback_hash
            },
            validate: async () => ({ ok: true }),
            sanitize: async () => ({
              userId: Number(callback.user_id),
              callbackHash: String(callback.callback_hash).trim()
            }),
            execute: async ({ userId, callbackHash }) => {
              await processQueuedCallback(userId, callbackHash);
              return { processed: true };
            },
            confirm: async ({ executionResult }) => ({
              ok: Boolean(executionResult?.processed),
              reason: executionResult?.processed ? null : "callback_not_processed"
            })
          });

          if (callbackResult.ok) {
            successCount += 1;
          } else {
            failCount += 1;
          }
        }

        return { count: pendingCallbacks.length, successCount, failCount };
      },
      confirm: async ({ executionResult }) => ({
        ok: true,
        details: executionResult
      })
    });
  };

  // Start processing loop
  const processTimer = setInterval(processQueue, QUEUE_PROCESS_INTERVAL);
  timers.push(processTimer);

  // Also run maintenance every 5 minutes to clean up failed items
  const maintenanceTimer = setInterval(async () => {
    await runCronAction({
      action: "callback_queue_maintenance",
      logStart: false,
      validateFailureLogLevel: "debug",
      prepare: async () => ({
        failedCount: await get(
          "SELECT COUNT(*) as count FROM callback_queue WHERE status = 'failed' AND processed_at IS NOT NULL LIMIT 1"
        )
      }),
      validate: async ({ failedCount }) => {
        const count = Number(failedCount?.count || 0);
        if (count <= 100) {
          return { ok: false, reason: "below_cleanup_threshold", details: { count } };
        }
        return { ok: true, details: { count } };
      },
      sanitize: async ({ failedCount }) => ({
        deleteBefore: Date.now() - (7 * 24 * 60 * 60 * 1000),
        failedCount: Number(failedCount?.count || 0)
      }),
      execute: async ({ deleteBefore, failedCount }) => {
        await run("DELETE FROM callback_queue WHERE status = 'failed' AND processed_at < ?", [deleteBefore]);
        return { failedCount };
      },
      confirm: async ({ executionResult }) => ({
        ok: true,
        details: { deletedCandidates: executionResult.failedCount }
      })
    });
  }, 5 * 60 * 1000);

  timers.push(maintenanceTimer);

  logger.info("Callback queue processing started", {
    processInterval: QUEUE_PROCESS_INTERVAL,
    batchSize: QUEUE_BATCH_SIZE
  });

  return {
    callbackQueueTimer: processTimer,
    callbackQueueMaintenanceTimer: maintenanceTimer
  };
}

module.exports = {
  startCallbackQueueProcessing
};
