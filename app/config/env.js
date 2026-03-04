const { z } = require("zod");

const positiveInt = (fallback) =>
  z.coerce
    .number()
    .int()
    .positive()
    .catch(fallback);

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: positiveInt(3000),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  CORS_ORIGINS: z.string().optional(),

  HTTP_GLOBAL_RATE_WINDOW_MS: positiveInt(60_000),
  HTTP_GLOBAL_RATE_MAX: positiveInt(240),
  HTTP_API_RATE_WINDOW_MS: positiveInt(60_000),
  HTTP_API_RATE_MAX: positiveInt(120),
  BLOCK_DIRECT_API_NAVIGATION: z.coerce.boolean().catch(true),

  SOCKET_MAX_HTTP_BUFFER_SIZE: positiveInt(64 * 1024),
  SOCKET_PING_INTERVAL_MS: positiveInt(25_000),
  SOCKET_PING_TIMEOUT_MS: positiveInt(20_000),
  SOCKET_CONNECT_TIMEOUT_MS: positiveInt(10_000),

  SERVER_REQUEST_TIMEOUT_MS: positiveInt(30_000),
  SERVER_HEADERS_TIMEOUT_MS: positiveInt(35_000),
  SERVER_KEEPALIVE_TIMEOUT_MS: positiveInt(5_000),

  CHECKIN_RECEIVER: z.string().default("0x95EA8E99063A3EF1B95302aA1C5bE199653EEb13"),
  CHECKIN_AMOUNT_WEI: z
    .string()
    .default("10000000000000000")
    .transform((value) => BigInt(value)),
  POLYGON_CHAIN_ID: z.coerce.number().int().positive().catch(137),
  POLYGON_RPC_URL: z.string().url().default("https://polygon-bor-rpc.publicnode.com"),
  POLYGON_RPC_TIMEOUT_MS: positiveInt(4500),

  ONLINE_START_DATE: z.string().default("2026-02-13"),
  MEMORY_GAME_REWARD_GH: z.coerce.number().positive().catch(5)
});

function loadEnv(rawEnv = process.env) {
  const parsed = EnvSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue?.message || "Invalid environment configuration");
  }

  const env = parsed.data;

  return {
    ...env,
    IS_PROD: env.NODE_ENV === "production",
    YOUTUBE_WATCH_REWARD_GH: 3,
    YOUTUBE_WATCH_CLAIM_INTERVAL_MS: 60_000,
    YOUTUBE_WATCH_BOOST_DURATION_MS: 24 * 60 * 60 * 1000
  };
}

module.exports = {
  loadEnv
};
