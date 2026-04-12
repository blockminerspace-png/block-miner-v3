import { z } from "zod";
import {
  completeMinigameSession,
  getMinigameStatus,
  startMinigameSession
} from "../services/minigameService.js";

const sessionBodySchema = z
  .object({
    sessionId: z.coerce.number().int().positive()
  })
  .strict();

function clientMeta(req) {
  return {
    ip: req.ip || null,
    userAgent: typeof req.get === "function" ? req.get("user-agent") || null : null
  };
}

export async function getStatus(req, res) {
  try {
    const userId = req.user.id;
    const data = await getMinigameStatus(userId);
    res.json(data);
  } catch (e) {
    console.error("minigame getStatus", e);
    res.status(500).json({ ok: false, code: "error" });
  }
}

export async function postStart(req, res) {
  try {
    const userId = req.user.id;
    const r = await startMinigameSession(userId);
    if (!r.ok) {
      return res.status(r.status || 400).json({
        ok: false,
        code: r.code,
        cooldownEndsAt: r.cooldownEndsAt,
        cooldownSecondsRemaining: r.cooldownSecondsRemaining
      });
    }
    res.json({ ok: true, reused: r.reused, session: r.session });
  } catch (e) {
    console.error("minigame postStart", e);
    res.status(500).json({ ok: false, code: "error" });
  }
}

export async function postComplete(req, res) {
  try {
    const parsed = sessionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, code: "INVALID_BODY" });
    }
    const userId = req.user.id;
    const r = await completeMinigameSession(userId, parsed.data.sessionId, clientMeta(req));
    if (!r.ok) {
      return res.status(r.status || 400).json({ ok: false, code: r.code });
    }
    res.json({
      ok: true,
      idempotent: Boolean(r.idempotent),
      rewardHashRate: r.rewardHashRate,
      powerDays: r.powerDays,
      nextPlayAllowedAt: r.nextPlayAllowedAt,
      cooldownSecondsRemaining: r.cooldownSecondsRemaining
    });
  } catch (e) {
    console.error("minigame postComplete", e);
    res.status(500).json({ ok: false, code: "error" });
  }
}

/** Alias for clients that prefer a "claim" action — same validation as `complete`. */
export async function postClaim(req, res) {
  return postComplete(req, res);
}
