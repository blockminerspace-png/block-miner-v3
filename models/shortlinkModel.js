const { get, all, run } = require("../src/db/sqlite");

const DEFAULT_TOTAL_STEPS = 3;
const DEFAULT_DAILY_LIMIT = 10;

// Get shortlink completion status for user
async function getUserShortlinkStatus(userId) {
  const query = `
    SELECT
      *
    FROM shortlink_completions
    WHERE user_id = ?
  `;
  
  const status = await get(query, [userId]);
  
  if (!status) {
    return {
      id: null,
      user_id: userId,
      shortlink_type: "internal",
      current_step: 0,
      daily_runs: 0,
      completed_at: null,
      reset_at: null,
      created_at: null,
      isCompleted: false,
      canRetry: true,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      remainingRuns: DEFAULT_DAILY_LIMIT
    };
  }

  const now = Date.now();
  const completedRuns = Number(status.daily_runs || 0);
  const isCompleted = completedRuns >= DEFAULT_DAILY_LIMIT;
  const resetAt = status.reset_at ?? null;
  
  // Check if can retry (daily reset at 9 AM BRT)
  const canRetry = !isCompleted || (resetAt && resetAt <= now);
  
  return {
    ...status,
    shortlink_type: status.shortlink_type || "internal",
    current_step: Number(status.current_step || 0),
    daily_runs: completedRuns,
    completed_at: status.completed_at ?? null,
    reset_at: resetAt,
    created_at: status.created_at ?? null,
    isCompleted,
    canRetry,
    dailyLimit: DEFAULT_DAILY_LIMIT,
    remainingRuns: Math.max(DEFAULT_DAILY_LIMIT - completedRuns, 0)
  };
}

// Update shortlink step
async function updateShortlinkStep(userId, step) {
  const now = Date.now();
  const existing = await get(
    "SELECT id FROM shortlink_completions WHERE user_id = ?",
    [userId]
  );
  
  if (existing) {
    await run(
      `UPDATE shortlink_completions 
       SET current_step = ?
       WHERE user_id = ?`,
      [step, userId]
    );
  } else {
    await run(
      `INSERT INTO shortlink_completions (user_id, shortlink_type, current_step, daily_runs, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, "internal", step, 0, now]
    );
  }
}

// Mark one 3-step run as completed and increment daily runs
async function completeShortlinkRun(userId, totalSteps = DEFAULT_TOTAL_STEPS) {
  const now = Date.now();
  
  const existing = await get(
    "SELECT id FROM shortlink_completions WHERE user_id = ?",
    [userId]
  );
  
  if (existing) {
    await run(
      `UPDATE shortlink_completions
       SET current_step = 0,
           completed_at = ?,
           daily_runs = COALESCE(daily_runs, 0) + 1
       WHERE user_id = ?`,
      [now, userId]
    );
  } else {
    await run(
      `INSERT INTO shortlink_completions (user_id, shortlink_type, current_step, daily_runs, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "internal", 0, 1, now, now]
    );
  }
  
  const status = await getUserShortlinkStatus(userId);
  return {
    completedAt: now,
    totalSteps: Number(totalSteps),
    dailyRuns: Number(status.daily_runs || 0),
    remainingRuns: Number(status.remainingRuns || 0)
  };
}

async function startShortlinkRun(userId) {
  const now = Date.now();

  const existing = await get(
    "SELECT id FROM shortlink_completions WHERE user_id = ?",
    [userId]
  );

  if (existing) {
    await run(
      `UPDATE shortlink_completions
       SET current_step = 0
       WHERE user_id = ?`,
      [userId]
    );
    return;
  }

  await run(
    `INSERT INTO shortlink_completions (user_id, shortlink_type, current_step, daily_runs, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, "internal", 0, 0, now]
  );
}

// Reset shortlink completion (called by cron at 9 AM BRT daily)
async function resetShortlinkCompletion(userId) {
  const now = Date.now();
  
  await run(
    `UPDATE shortlink_completions
     SET completed_at = NULL, current_step = 0, daily_runs = 0, reset_at = ?
     WHERE user_id = ?`,
    [now, userId]
  );
}

// Reset all shortlinks (called by cron daily)
async function resetAllShortlinks() {
  const now = Date.now();
  
  const result = await run(
    `UPDATE shortlink_completions
     SET completed_at = NULL, current_step = 0, daily_runs = 0, reset_at = ?
     WHERE completed_at IS NOT NULL OR COALESCE(daily_runs, 0) > 0 OR current_step > 0`,
    [now]
  );
  
  return result;
}

module.exports = {
  getUserShortlinkStatus,
  updateShortlinkStep,
  startShortlinkRun,
  completeShortlinkRun,
  resetShortlinkCompletion,
  resetAllShortlinks
};
