function toFunctionList(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter((entry) => typeof entry === "function");
  }
  return typeof input === "function" ? [input] : [];
}

function clearTimerHandles(handles) {
  if (!handles || typeof handles !== "object") return;

  for (const value of Object.values(handles)) {
    if (value && typeof value === "object" && typeof value.hasRef === "function") {
      clearTimeout(value);
      clearInterval(value);
    }
  }
}

function setupGracefulShutdown({ logger, server, io, cronHandles, extraCleanup }) {
  const cleanupFns = toFunctionList(extraCleanup);
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.warn("Shutdown signal received", { signal });

    clearTimerHandles(cronHandles);

    for (const fn of cleanupFns) {
      try {
        await fn();
      } catch (error) {
        logger.error("Shutdown cleanup task failed", { error: error?.message || "unknown_error" });
      }
    }

    await new Promise((resolve) => {
      io.close(() => resolve());
    });

    await new Promise((resolve) => {
      server.close(() => resolve());
    });

    logger.info("Server shutdown complete", { signal });
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = {
  setupGracefulShutdown
};
