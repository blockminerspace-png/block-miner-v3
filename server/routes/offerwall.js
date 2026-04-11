import express from "express";
import { offerwallMePostback } from "../controllers/offerwallController.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

export const offerwallRouter = express.Router();

const postbackLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 120,
  message: "Too many postback requests."
});

// The postback URL will be /api/offerwall/postback
// It supports both GET and POST requests
offerwallRouter.get("/postback", postbackLimiter, offerwallMePostback);
offerwallRouter.post("/postback", postbackLimiter, offerwallMePostback);
