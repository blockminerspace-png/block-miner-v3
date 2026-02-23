const shortlinkModel = require("../models/shortlinkModel");
const inventoryModel = require("../models/inventoryModel");
const shortlinkRewardModel = require("../models/shortlinkRewardModel");
const logger = require("../utils/logger").child("ShortlinkController");

const TOTAL_STEPS = 3;
const MAX_DAILY_RUNS = 10;

// Get shortlink status
async function getShortlinkStatus(req, res) {
  try {
    const userId = req.user.id;
    await shortlinkRewardModel.ensureDefaultInternalReward();
    
    const status = await shortlinkModel.getUserShortlinkStatus(userId);
    
    res.json({
      ok: true,
      status: {
        ...status,
        shortlinkName: "Internal Shortlink",
        rewardName: "5 GHS Mining Machine",
        totalSteps: TOTAL_STEPS,
        maxDailyRuns: MAX_DAILY_RUNS
      }
    });
  } catch (error) {
    logger.error("Failed to get shortlink status", {
      userId: req.user?.id,
      error: error.message
    });
    
    res.status(500).json({
      ok: false,
      message: "Failed to get shortlink status"
    });
  }
}

async function startShortlink(req, res) {
  try {
    const userId = req.user.id;
    await shortlinkRewardModel.ensureDefaultInternalReward();
    const status = await shortlinkModel.getUserShortlinkStatus(userId);
    const completedRuns = Number(status.daily_runs || 0);

    if (completedRuns >= MAX_DAILY_RUNS && Number(status.current_step || 0) === 0) {
      return res.status(400).json({
        ok: false,
        message: "Daily limit reached. You can run this shortlink up to 10 times per day."
      });
    }

    await shortlinkModel.startShortlinkRun(userId);

    res.json({
      ok: true,
      nextStep: 1,
      path: "/shortlink/internal-shortlink/step1"
    });
  } catch (error) {
    logger.error("Failed to start shortlink", {
      userId: req.user?.id,
      error: error.message
    });

    res.status(500).json({
      ok: false,
      message: "Failed to start shortlink"
    });
  }
}

// Complete a shortlink step
async function completeShortlinkStep(req, res) {
  try {
    const userId = req.user.id;
    const { step } = req.body;
    const normalizedStep = Number(step);
    
    if (!normalizedStep || normalizedStep < 1 || normalizedStep > TOTAL_STEPS) {
      return res.status(400).json({
        ok: false,
        message: `Invalid step. Expected 1 to ${TOTAL_STEPS}`
      });
    }
    
    // Get current status
    const status = await shortlinkModel.getUserShortlinkStatus(userId);
    
    const completedRuns = Number(status.daily_runs || 0);
    if (completedRuns >= MAX_DAILY_RUNS && Number(status.current_step || 0) === 0) {
      return res.status(400).json({
        ok: false,
        message: "Daily limit reached. You can run this shortlink up to 10 times per day."
      });
    }

    const expectedStep = Number(status.current_step || 0) + 1;
    if (normalizedStep !== expectedStep) {
      return res.status(400).json({
        ok: false,
        message: `Invalid sequence. Complete step ${expectedStep} first.`
      });
    }
    
    // Update step
    await shortlinkModel.updateShortlinkStep(userId, normalizedStep);
    
    let reward = null;
    
    let runInfo = null;

    // If final step is completed, register run and grant reward
    if (normalizedStep === TOTAL_STEPS) {
      runInfo = await shortlinkModel.completeShortlinkRun(userId, TOTAL_STEPS);
      
      // Grant 5 GHS machine to user
      reward = await grantRewardMachine(userId);
      
      logger.info("User completed shortlink", {
        userId,
        step: TOTAL_STEPS,
        reward: reward
      });
    }
    
    res.json({
      ok: true,
      message: "Step completed",
      step: normalizedStep,
      totalSteps: TOTAL_STEPS,
      runCompleted: normalizedStep === TOTAL_STEPS,
      reward,
      dailyRuns: runInfo?.dailyRuns ?? completedRuns,
      remainingRuns: runInfo?.remainingRuns ?? Math.max(MAX_DAILY_RUNS - completedRuns, 0),
      maxDailyRuns: MAX_DAILY_RUNS
    });
  } catch (error) {
    logger.error("Failed to complete shortlink step", {
      userId: req.user?.id,
      error: error.message
    });
    
    res.status(500).json({
      ok: false,
      message: "Failed to complete step"
    });
  }
}

// Grant reward machine (5 GHS) to user
async function grantRewardMachine(userId) {
  try {
    const now = Date.now();
    await shortlinkRewardModel.ensureDefaultInternalReward();
    const reward = await shortlinkRewardModel.getActiveRewardByType("internal");

    if (!reward?.miner_id) {
      throw new Error("Shortlink reward configuration not found");
    }

    const result = await inventoryModel.addInventoryItem(
      userId,
      reward.reward_name || reward.miner_name || "Shortlink Reward 5 GHS",
      1,
      Number(reward.hash_rate || 0),
      Number(reward.slot_size || 1),
      now,
      now,
      reward.miner_id,
      reward.image_url || null
    );

    logger.info("Reward machine granted to user", {
      userId,
      hashRate: Number(reward.hash_rate || 0),
      minerId: reward.miner_id,
      image: reward.image_url || null,
      destination: "inventory"
    });

    return {
      id: result.lastID,
      minerId: reward.miner_id,
      hashRate: Number(reward.hash_rate || 0),
      image: reward.image_url || null,
      location: "inventory",
      message: "You received a 5 GHS machine in your inventory!"
    };
  } catch (error) {
    logger.error("Failed to grant reward machine", {
      userId,
      error: error.message
    });
    
    throw error;
  }
}

module.exports = {
  getShortlinkStatus,
  startShortlink,
  completeShortlinkStep,
  grantRewardMachine
};
