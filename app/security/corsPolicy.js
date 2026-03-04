const os = require("os");

function parseCorsOrigins(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getLocalOrigins(port) {
  const origins = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const net of entries || []) {
      if (net.family === "IPv4" && !net.internal) {
        origins.add(`http://${net.address}:${port}`);
      }
    }
  }

  return Array.from(origins);
}

function createCorsPolicy({ corsOrigins, port, isProd }) {
  const explicitOrigins = parseCorsOrigins(corsOrigins);
  const fallbackOrigins = isProd ? [] : getLocalOrigins(port);
  const corsAllowList = explicitOrigins.length > 0 ? explicitOrigins : fallbackOrigins;
  const allowedOriginSet = new Set(corsAllowList);

  function isOriginAllowed(origin) {
    if (!origin) return true;
    if (explicitOrigins.length === 0 && isProd) {
      return false;
    }
    return allowedOriginSet.has(origin);
  }

  function originHandler(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  }

  return {
    corsAllowList,
    isOriginAllowed,
    originHandler,
    expressCorsOptions: {
      origin: originHandler,
      credentials: true
    },
    socketCorsOptions: {
      origin: originHandler,
      credentials: true
    }
  };
}

module.exports = {
  createCorsPolicy
};
