const { get, all, run } = require("../models/db");
const logger = require("../utils/logger").child("CallbackQueueCron");
const { processQueuedCallback } = require("../controllers/zeradsController");

const QUEUE_PROCESS_INTERVAL = 1000; // Process every 1 second
const QUEUE_BATCH_SIZE = 10; // Process max 10 items at a time

function startCallbackQueueProcessing() {
  const timers = [];

  const processQueue = async () => {
    try {
      // Find pending callbacks that are ready to process
      const pendingCallbacks = await all(
        `
          SELECT id, user_id, callback_hash
          FROM callback_queue
          WHERE status = 'pending'
            AND (next_retry_at IS NULL OR next_retry_at <= ?)
          ORDER BY created_at ASC
          LIMIT ?
        `,
        [Date.now(), QUEUE_BATCH_SIZE]
      );

      if (pendingCallbacks.length === 0) {
        return;
      }

      logger.debug(`Processing ${pendingCallbacks.length} queued callbacks`);

      // Process each callback in background
      for (const callback of pendingCallbacks) {
        try {
          await processQueuedCallback(callback.user_id, callback.callback_hash);
        } catch (error) {
          logger.error("Failed to process callback from queue", {
            error: error.message,
            callbackId: callback.id,
            userId: callback.user_id,
            callbackHash: callback.callback_hash
          });
        }
      }
    } catch (error) {
      logger.error("Error in callback queue processing loop", {
        error: error.message
      });
    }
  };

  // Start processing loop
  const processTimer = setInterval(processQueue, QUEUE_PROCESS_INTERVAL);
  timers.push(processTimer);

  // Also run maintenance every 5 minutes to clean up failed items
  const maintenanceTimer = setInterval(async () => {
    try {
      const failedCount = await get(
        "SELECT COUNT(*) as count FROM callback_queue WHERE status = 'failed' AND processed_at IS NOT NULL LIMIT 1"
      );

      if (failedCount?.count > 100) {
        // Archive or delete old failed callbacks after 7 days
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        await run(
          "DELETE FROM callback_queue WHERE status = 'failed' AND processed_at < ?",
          [sevenDaysAgo]
        );

        logger.info("Cleaned up old failed callbacks", { deletedCount: failedCount.count });
      }
    } catch (error) {
      logger.error("Error in callback queue maintenance", {
        error: error.message
      });
    }
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
