import express from "express";
import { createRateLimiter } from "../middleware/rateLimit.js";
import * as publicLiveStatsController from "../controllers/publicLiveStatsController.js";

export const publicLiveStatsRouter = express.Router();

const liveStatsLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
});

publicLiveStatsRouter.get("/live-stats", liveStatsLimiter, publicLiveStatsController.getLiveStats);
