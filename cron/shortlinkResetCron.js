const logger = require("../utils/logger").child("ShortlinkResetCron");
const shortlinkModel = require("../models/shortlinkModel");
const { createCronActionRunner } = require("./cronActionRunner");

const runCronAction = createCronActionRunner({ logger, cronName: "ShortlinkResetCron" });

// Get next 9 AM BRT time
function getNext9AMBRT() {
  const now = new Date();
  // BRT is UTC-3
  const brtOffset = -3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() + brtOffset);
  
  let next9AM = new Date(brtNow);
  next9AM.setHours(9, 0, 0, 0);
  
  // If 9 AM already passed today, schedule for tomorrow
  if (next9AM.getTime() <= brtNow.getTime()) {
    next9AM.setDate(next9AM.getDate() + 1);
  }
  
  // Convert back to UTC
  const msUntil = next9AM.getTime() - brtNow.getTime();
  return msUntil;
}

async function resetShortlinks() {
  await runCronAction({
    action: "reset_shortlinks",
    logStart: false,
    validate: async () => ({ ok: typeof shortlinkModel.resetAllShortlinks === "function", reason: "missing_reset_function" }),
    sanitize: async () => ({}),
    execute: async () => {
      const result = await shortlinkModel.resetAllShortlinks();
      return { updatedRows: Number(result?.changes || 0) };
    },
    confirm: async ({ executionResult }) => ({
      ok: true,
      details: { updatedRows: executionResult.updatedRows }
    })
  });
}

function startShortlinkResetCron() {
  try {
    // Get time until next 9 AM BRT
    const msUntilNext9AM = getNext9AMBRT();
    
    logger.info("Shortlink reset cron scheduled", {
      nextResetIn: Math.round(msUntilNext9AM / 1000 / 60) + " minutes"
    });
    
    // Schedule first reset
    const resetTimer = setTimeout(() => {
      resetShortlinks();
      
      // After first reset, schedule it to run every 24 hours
      setInterval(() => {
        resetShortlinks();
      }, 24 * 60 * 60 * 1000); // Every 24 hours
    }, msUntilNext9AM);
    
    return {
      resetTimer
    };
  } catch (error) {
    logger.error("Failed to start shortlink reset cron", {
      error: error.message
    });
    
    return {
      resetTimer: null
    };
  }
}

module.exports = {
  startShortlinkResetCron
};
