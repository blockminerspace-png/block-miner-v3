import prisma from "../../src/db/prisma.js";
import loggerLib from "../../utils/logger.js";
import { checkStreamCaptureEnvironment } from "./streamEnvCheck.js";
import { startLiveRtmpPipeline } from "./liveRtmpPipeline.js";
import { getDecryptedStreamCredentials } from "./youtubeStreamService.js";

const logger = loggerLib.child("StreamRunner");

/** @type {Map<number, { stop: () => Promise<void>, hb: ReturnType<typeof setInterval> | null, ffmpeg: import('child_process').ChildProcessWithoutNullStreams | null }>} */
const active = new Map();

/**
 * @param {number} id
 */
async function updateRow(id, data) {
  try {
    await prisma.streamDestination.update({ where: { id }, data });
  } catch (e) {
    logger.error("streamDestination update failed", { id, error: String(e?.message || e) });
  }
}

/**
 * @param {number} id
 */
export async function startStreamForDestination(id) {
  if (active.has(id)) {
    logger.info("stream already active", { id });
    return { ok: true };
  }

  const env = checkStreamCaptureEnvironment();
  if (!env.ok) {
    await updateRow(id, {
      desiredRunning: false,
      lastWorkerStatus: "ERROR",
      lastError: env.issues.join(" "),
      lastStoppedAt: new Date()
    });
    return { ok: false, message: env.issues.join(" ") };
  }

  const row = await prisma.streamDestination.findUnique({ where: { id } });
  if (!row || !row.enabled) {
    return { ok: false, message: "Destination disabled or not found." };
  }
  if (!row.desiredRunning) {
    return { ok: false, message: "Start not requested." };
  }

  const creds = getDecryptedStreamCredentials(row);
  if (!creds) {
    await updateRow(id, {
      desiredRunning: false,
      lastWorkerStatus: "ERROR",
      lastError: "Missing stream key or STREAM_ENCRYPTION_KEY mismatch.",
      lastStoppedAt: new Date()
    });
    return { ok: false, message: "Invalid stream key configuration." };
  }

  await updateRow(id, {
    lastWorkerStatus: "STARTING",
    lastError: null,
    lastStartedAt: new Date()
  });

  const displayNum = 90 + (id % 400);
  const display = `:${displayNum}`;

  let handle;
  try {
    let lastLog = "";
    handle = await startLiveRtmpPipeline({
      captureUrl: row.captureUrl,
      rtmpOutUrl: creds.rtmpUrl,
      display,
      width: row.videoWidth,
      height: row.videoHeight,
      videoBitrateK: row.videoBitrateK,
      audioBitrateK: row.audioBitrateK,
      onFfmpegLog: (line) => {
        lastLog = line;
      }
    });

    const ffmpeg = handle.ffmpegProcess;
    const hb = setInterval(() => {
      void updateRow(id, { lastHeartbeatAt: new Date(), lastError: null });
    }, 15000);

    ffmpeg?.once("exit", async (code) => {
      const cur = active.get(id);
      if (!cur) return;
      if (cur.hb) clearInterval(cur.hb);
      active.delete(id);
      const still = await prisma.streamDestination.findUnique({ where: { id } });
      if (!still) return;
      if (!still.desiredRunning) {
        await updateRow(id, {
          lastWorkerStatus: "OFFLINE",
          lastStoppedAt: new Date(),
          lastError: code === 0 ? null : `ffmpeg exited (${code}). ${lastLog.slice(0, 400)}`
        });
        return;
      }
      await updateRow(id, {
        desiredRunning: false,
        lastWorkerStatus: "ERROR",
        lastStoppedAt: new Date(),
        lastError: `ffmpeg exited (${code}). ${lastLog.slice(0, 400)}`
      });
    });

    active.set(id, { stop: handle.stop, hb, ffmpeg });
    await updateRow(id, {
      lastWorkerStatus: "ONLINE",
      lastHeartbeatAt: new Date(),
      lastError: null
    });
    logger.info("stream online", { id });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("stream start failed", { id, error: msg });
    await updateRow(id, {
      desiredRunning: false,
      lastWorkerStatus: "ERROR",
      lastError: msg.slice(0, 2000),
      lastStoppedAt: new Date()
    });
    if (handle?.stop) await handle.stop();
    return { ok: false, message: msg };
  }
}

/**
 * @param {number} id
 */
export async function stopStreamForDestination(id) {
  const cur = active.get(id);
  if (cur?.hb) clearInterval(cur.hb);
  active.delete(id);
  if (cur?.stop) await cur.stop();
  await updateRow(id, {
    lastWorkerStatus: "OFFLINE",
    lastStoppedAt: new Date(),
    lastError: null
  });
  logger.info("stream stopped", { id });
}

export async function shutdownAllStreams() {
  const ids = [...active.keys()];
  for (const id of ids) {
    await stopStreamForDestination(id);
  }
}

/**
 * @param {number} id
 */
export function isStreamActive(id) {
  return active.has(id);
}
