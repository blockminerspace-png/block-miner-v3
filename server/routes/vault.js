import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { getVault, moveToVault, retrieveFromVault } from "../controllers/vaultController.js";
import { moveToVaultBodySchema, retrieveFromVaultBodySchema } from "../utils/vaultSchemas.js";

const router = express.Router();

router.use(requireAuth);

const vaultWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });

router.get("/", getVault);
router.post("/move-to-vault", vaultWriteLimiter, validateBody(moveToVaultBodySchema), moveToVault);
router.post(
  "/retrieve-from-vault",
  vaultWriteLimiter,
  validateBody(retrieveFromVaultBodySchema),
  retrieveFromVault
);

export default router;
