let miningEngine = null;

function setMiningEngine(engine) {
  miningEngine = engine || null;
}

function getMiningEngine() {
  return miningEngine;
}

function applyUserBalanceDelta(userId, delta) {
  const engine = getMiningEngine();
  if (!engine || typeof engine.findMinerByUserId !== "function") {
    return false;
  }

  const numericUserId = Number(userId);
  const numericDelta = Number(delta);
  if (!Number.isFinite(numericUserId) || !Number.isFinite(numericDelta) || numericDelta === 0) {
    return false;
  }

  const miner = engine.findMinerByUserId(numericUserId);
  if (!miner) {
    return false;
  }

  const currentBalance = Number(miner.balance || 0);
  miner.balance = Math.max(0, currentBalance + numericDelta);
  return true;
}

module.exports = {
  setMiningEngine,
  getMiningEngine,
  applyUserBalanceDelta
};
