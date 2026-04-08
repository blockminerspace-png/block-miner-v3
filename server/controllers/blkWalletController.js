import loggerLib from "../utils/logger.js";
import { getBlkEconomyConfig, serializeBlkConfigPublic, updateBlkEconomyConfig } from "../models/blkEconomyModel.js";
import { convertPolToBlk, estimatePolToBlk } from "../models/blkWalletModel.js";

const logger = loggerLib.child("BlkWalletController");

export async function getEconomy(req, res) {
  try {
    const row = await getBlkEconomyConfig();
    res.json({ ok: true, economy: serializeBlkConfigPublic(row) });
  } catch (e) {
    logger.error("getEconomy", { error: e.message });
    res.status(500).json({ ok: false, message: "Unable to load BLK settings." });
  }
}

export async function getEstimate(req, res) {
  try {
    const pol = req.query.pol ?? req.query.pol_amount;
    const row = await getBlkEconomyConfig();
    const est = estimatePolToBlk(row, pol);
    if (!est) {
      return res.status(400).json({ ok: false, message: "Invalid pol amount" });
    }
    res.json({ ok: true, estimate: est });
  } catch (e) {
    logger.error("getEstimate", { error: e.message });
    res.status(500).json({ ok: false, message: "Estimate failed." });
  }
}

export async function postConvert(req, res) {
  try {
    const { pol_amount: polAmountSnake, polAmount: polCamel } = req.body;
    const raw = polAmountSnake ?? polCamel;
    const result = await convertPolToBlk(req.user.id, raw);
    res.json({
      ok: true,
      blkReceived: result.blkOut,
      polFee: result.feePol,
      polDeducted: result.polGross,
      transactionId: result.transaction.id
    });
  } catch (e) {
    logger.warn("postConvert", { userId: req.user?.id, error: e.message });
    res.status(400).json({ ok: false, message: e.message || "Conversion failed." });
  }
}

/** Admin: full config row + serialized (admin panel) */
export async function adminGetEconomy(_req, res) {
  try {
    const row = await getBlkEconomyConfig();
    res.json({ ok: true, config: row, economy: serializeBlkConfigPublic(row) });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
}

export async function adminPutEconomy(req, res) {
  try {
    const row = await updateBlkEconomyConfig(req.body || {});
    res.json({ ok: true, config: row, economy: serializeBlkConfigPublic(row) });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message || "Update failed" });
  }
}
