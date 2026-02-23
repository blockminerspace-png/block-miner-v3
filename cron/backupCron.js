const logger = require("../utils/logger").child("BackupCron");
const { createDatabaseBackup, pruneBackups, getBackupConfig } = require("../utils/backup");
const { createCronActionRunner } = require("./cronActionRunner");
const cron = require('node-cron');
const config = require('../src/config');

const DEFAULT_STARTUP_DELAY_MS = 60_000;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function getIntervalMs() {
  const intervalMs = parseNumber(process.env.BACKUP_INTERVAL_MS, NaN);
  if (Number.isFinite(intervalMs) && intervalMs > 0) return intervalMs;

  const intervalHours = parseNumber(process.env.BACKUP_INTERVAL_HOURS, NaN);
  if (Number.isFinite(intervalHours) && intervalHours > 0) return intervalHours * 60 * 60 * 1000;

  return DEFAULT_INTERVAL_MS;
}

function startBackupCron({ run }) {
  const runCronAction = createCronActionRunner({ logger, cronName: "BackupCron" });
  const enabled = parseBoolean(process.env.BACKUP_ENABLED, true);
  if (!enabled) {
    logger.info("Backup cron disabled via BACKUP_ENABLED");
    return {};
  }

  const runOnStartup = parseBoolean(process.env.BACKUP_RUN_ON_STARTUP, true);

  const startupDelayMs = Math.max(0, parseNumber(process.env.BACKUP_STARTUP_DELAY_MS, DEFAULT_STARTUP_DELAY_MS));
  const intervalMs = getIntervalMs();

  const tick = async () => {
    await runCronAction({
      action: "backup_tick",
      meta: { trigger: "scheduler" },
      prepare: async () => ({ backupConfig: getBackupConfig(), hasRunFn: typeof run === "function" }),
      validate: async ({ hasRunFn }) => {
        if (!hasRunFn) {
          return { ok: false, reason: "missing_run_function" };
        }
        return { ok: true };
      },
      sanitize: async ({ backupConfig }) => ({
        backupConfig
      }),
      execute: async ({ backupConfig }) => {
        const result = await createDatabaseBackup({ run, ...backupConfig, logger });
        await pruneBackups({ ...backupConfig, logger });
        return result;
      },
      confirm: async ({ executionResult }) => ({
        ok: Boolean(executionResult?.backupFile),
        reason: executionResult?.backupFile ? null : "missing_backup_file",
        details: {
          backupFile: executionResult?.backupFile || null,
          method: executionResult?.method || null
        }
      })
    });
  };

  // If configuration provides a cron expression, schedule with node-cron
  const cronExpr = config?.schedules?.backupCron;
  if (cronExpr) {
    try {
      const task = cron.schedule(cronExpr, () => {
        tick().catch(err => logger.error('Backup tick failed', { error: err.message }));
      }, { scheduled: true });

      if (runOnStartup) setTimeout(() => tick(), startupDelayMs);

      logger.info('Backup cron started (cron)', { cron: cronExpr, runOnStartup, startupDelayMs });
      return { backupCronTask: task };
    } catch (error) {
      logger.error('Invalid backup cron expression, falling back to interval', { cronExpr, error: error.message });
    }
  }

  const startupTimer = runOnStartup
    ? setTimeout(() => {
        tick();
      }, startupDelayMs)
    : null;

  const backupTimer = setInterval(() => {
    tick();
  }, intervalMs);

  logger.info("Backup cron started", { runOnStartup, startupDelayMs, intervalMs });

  return { backupTimer, backupStartupTimer: startupTimer };
}

module.exports = {
  startBackupCron
};
