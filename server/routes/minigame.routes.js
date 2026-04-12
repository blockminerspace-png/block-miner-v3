import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import * as minigameController from "../controllers/minigameController.js";

export const minigameRouter = express.Router();

const readLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const writeLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

minigameRouter.get("/status", requireAuth, readLimiter, minigameController.getStatus);
minigameRouter.post("/start", requireAuth, writeLimiter, minigameController.postStart);
minigameRouter.post("/complete", requireAuth, writeLimiter, minigameController.postComplete);
minigameRouter.post("/claim", requireAuth, writeLimiter, minigameController.postClaim);
