import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as gamesPowerController from "../controllers/gamesPowerController.js";

export const gamesRouter = express.Router();

gamesRouter.get("/active-powers", requireAuth, gamesPowerController.getActiveGamePowers);
