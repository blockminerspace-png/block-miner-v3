const DEFAULT_CLEANUP_MS = 10 * 60 * 1000;
const logger = require("../utils/logger").child("GamePowerCleanup");
const { createCronActionRunner } = require("./cronActionRunner");
const cron = require('node-cron');
const config = require('../src/config');

function startGamePowerCleanup({ run }, options = {}) {
  const runCronAction = createCronActionRunner({ logger, cronName: "GamePowerCleanup" });
  const cleanupMs = Number(options.cleanupMs || DEFAULT_CLEANUP_MS);

  const cleanup = async () => {
    await runCronAction({
      action: "cleanup_expired_game_powers",
      logStart: false,
      prepare: async () => ({ now: Date.now(), hasRunFn: typeof run === "function" }),
      validate: async ({ hasRunFn }) => {
        if (!hasRunFn) {
          return { ok: false, reason: "missing_run_function" };
        }
        return { ok: true };
      },
      sanitize: async ({ now }) => ({ now: Number(now) }),
      execute: async ({ now }) => {
        const result = await run("DELETE FROM users_powers_games WHERE expires_at <= ?", [now]);
        return { deletedRows: Number(result?.changes || 0) };
      },
      confirm: async ({ executionResult }) => ({
        ok: true,
        details: { deletedRows: executionResult.deletedRows }
      })
    });
  };

  // If a cron expression is provided, use it
  const cronExpr = config?.schedules?.gameCleanupCron;
  if (cronExpr) {
    try {
      const task = cron.schedule(cronExpr, () => {
        cleanup().catch((err) => logger.error("Game cleanup failed", { error: err.message }));
      }, { scheduled: true });

      // Run once on start
      cleanup();
      logger.info("Game cleanup cron started (cron)", { cron: cronExpr });
      return { cleanupCronTask: task };
    } catch (error) {
      logger.error("Invalid game cleanup cron, falling back to interval", { cronExpr, error: error.message });
    }
  }

  cleanup();
  const cleanupTimer = setInterval(cleanup, cleanupMs);
  logger.info("Game cleanup cron started", { cleanupMs });

  return { cleanupTimer };
}

module.exports = {
  startGamePowerCleanup
};
