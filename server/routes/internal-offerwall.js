import express from "express";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";
import * as internalOfferwallController from "../controllers/internalOfferwallController.js";

export const internalOfferwallRouter = express.Router();

const limiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const writeLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

internalOfferwallRouter.get("/status", limiter, internalOfferwallController.getFeatureStatus);
internalOfferwallRouter.get("/offers", requireAuth, limiter, internalOfferwallController.getOffers);
internalOfferwallRouter.post(
  "/offers/:offerId/start",
  requireAuth,
  writeLimiter,
  internalOfferwallController.postStart
);
internalOfferwallRouter.post(
  "/attempts/:attemptId/partner-opened",
  requireAuth,
  writeLimiter,
  internalOfferwallController.postPartnerOpened
);
internalOfferwallRouter.post(
  "/attempts/:attemptId/submit",
  requireAuth,
  writeLimiter,
  internalOfferwallController.postSubmit
);
