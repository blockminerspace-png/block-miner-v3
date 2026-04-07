import "dotenv/config";
import path from "path";
import fs from "fs/promises";
import http from "http";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import loggerLib from "./utils/logger.js";

// Middlewares
import { createRateLimiter } from "./middleware/rateLimit.js";
import { createCspMiddleware } from "./middleware/csp.js";

// Admin Routes
import { adminAuthRouter } from "./routes/admin-auth.js";
import { adminRouter } from "./routes/admin.js";
import { adminAutoMiningRewardsRouter } from "./routes/admin-auto-mining-rewards.js";
import * as healthController from "./controllers/healthController.js";

const logger = loggerLib.child("Server");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 1. Global Security Stack
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));
app.use(createCspMiddleware());
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : "*",
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate Limiter (admin only — less permissive)
const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many requests from this IP, please try again later."
});
app.use("/api", adminLimiter);

app.use("/api", (req, _res, next) => {
  logger.info(`[ADMIN API] ${req.method} ${req.originalUrl}`);
  next();
});

// 2. Admin API Routes
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/auto-mining-rewards", adminAutoMiningRewardsRouter);

// 3. Health check
app.get("/health", healthController.health);

// 4. Static uploads (keep serving uploads volume)
app.use("/uploads", express.static(process.env.UPLOADS_DIR || "/app/uploads"));
// Serve /machines/* from uploads/machines (image_url in DB uses /machines/filename)
app.use("/machines", express.static(path.join(process.env.UPLOADS_DIR || "/app/uploads", "machines")));

// 5. Serve admin SPA
const publicPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(publicPath, { index: false }));

// Redirect root to /admin/login
app.get("/", (_req, res) => res.redirect(302, "/admin/login"));

// Catch-all: serve admin SPA for all non-API routes
app.get("/{*all}", async (req, res) => {
  try {
    const indexPath = path.join(publicPath, "index.html");
    let html = await fs.readFile(indexPath, "utf8");
    const nonce = res.locals.cspNonce || "";
    html = html.replace(/__CSP_NONCE__/g, nonce);
    res.send(html);
  } catch (error) {
    logger.error("Error serving index.html", { error: error.message });
    res.status(500).send("Internal Server Error");
  }
});

// 6. Bootstrap
async function bootstrap() {
  try {
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || "0.0.0.0";
    server.listen(port, host, () => {
      logger.info(`[support-block-miner] Admin server running on ${host}:${port}`);
    });
  } catch (error) {
    logger.error("Bootstrap failed", { error: error.message });
    process.exit(1);
  }
}

bootstrap();
