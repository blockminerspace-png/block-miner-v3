import express from "express";
import { getOfferwallMeFrameUrl, offerwallMePostback } from "../controllers/offerwallController.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";

export const offerwallRouter = express.Router();

const postbackLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 120,
  message: "Too many postback requests."
});

const linkLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

offerwallRouter.get("/frame-url", requireAuth, linkLimiter, getOfferwallMeFrameUrl);

// The postback URL will be /api/offerwall/postback
// It supports both GET and POST requests
offerwallRouter.get("/postback", postbackLimiter, offerwallMePostback);
offerwallRouter.post("/postback", postbackLimiter, offerwallMePostback);
