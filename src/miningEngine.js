const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger").child("MiningEngine");

class MiningEngine {
  constructor() {
    this.tokenSymbol = "POL";
    this.blockNumber = 1;
    this.rewardBase = 0.1;
    this.blockTarget = 100;
    this.blockProgress = 0;
    this.blockDurationMs = 10 * 60 * 1000;
    this.blockStartedAt = Date.now();
    this.nextBlockAt = this.blockStartedAt + this.blockDurationMs;
    this.tokenPrice = 0.35;
    this.totalMinted = 0;
    this.lastReward = 0;
    this.roundWork = new Map();
    this.miners = new Map();
    this.minersByUserId = new Map(); // O(1) lookup index by userId
    this.lastBlockAt = Date.now();
    this.activeMiners = 0;
    this.currentNetworkHashRate = 0;
    this.blockHistory = [];
    this.logRewardCallback = null;
    this.persistBlockRewardsCallback = null;
  }

  setRewardLogger(callback) {
    this.logRewardCallback = callback;
  }

  /**
   * Register an async callback to atomically persist block rewards to the database.
   * The callback receives: { blockNumber, blockReward, totalWork, minerRewards, now }
   * If the callback throws, in-memory miner balances are rolled back.
   */
  setPersistBlockRewardsCallback(callback) {
    this.persistBlockRewardsCallback = callback;
  }

  findMinerByUserId(userId) {
    if (!userId) return null;
    return this.minersByUserId.get(userId) ?? null;
  }

  createOrGetMiner({ userId, username, walletAddress, profile }) {
    const existing = this.findMinerByUserId(userId);
    if (existing) {
      if (username) existing.username = username;
      if (walletAddress) existing.walletAddress = walletAddress;
      return existing;
    }

    const id = uuidv4();
    const miner = {
      id,
      userId,
      walletAddress: walletAddress || null,
      username: username || `Miner-${id.slice(0, 5)}`,
      rigs: Number(profile?.rigs || 1),
      baseHashRate: Number(profile?.baseHashRate || 0),
      active: true,
      boostMultiplier: 1,
      boostEndsAt: 0,
      balance: Number(profile?.balance || 0),
      lifetimeMined: Number(profile?.lifetimeMined || 0),
      connected: true
    };

    this.miners.set(id, miner);
    this.minersByUserId.set(userId, miner); // keep O(1) index in sync
    this.roundWork.set(id, 0);
    return miner;
  }

  setConnected(minerId, connected) {
    const miner = this.miners.get(minerId);
    if (!miner) {
      return;
    }
    miner.connected = connected;
  }

  setActive(minerId, active) {
    const miner = this.miners.get(minerId);
    if (!miner) {
      return null;
    }
    miner.active = !!active;
    return miner;
  }

  setWallet(minerId, walletAddress) {
    const miner = this.miners.get(minerId);
    if (!miner) {
      return null;
    }

    miner.walletAddress = walletAddress || null;
    return miner;
  }

  applyBoost(minerId) {
    const miner = this.miners.get(minerId);
    if (!miner) {
      return { ok: false, message: "Miner não encontrado." };
    }

    const boostCost = 0.35;
    if (miner.balance < boostCost) {
      return { ok: false, message: "Saldo insuficiente para boost." };
    }

    miner.balance -= boostCost;
    miner.boostMultiplier = 1.25;
    miner.boostEndsAt = Date.now() + 30000;

    return { ok: true, message: "Boost ativado por 30s." };
  }

  upgradeRig(minerId) {
    const miner = this.miners.get(minerId);
    if (!miner) {
      return { ok: false, message: "Miner não encontrado." };
    }

    const rigCost = 2 + (miner.rigs - 1) * 0.8;
    if (miner.balance < rigCost) {
      return { ok: false, message: `Você precisa de ${rigCost.toFixed(2)} ${this.tokenSymbol}.` };
    }

    miner.balance -= rigCost;
    miner.rigs += 1;
    miner.baseHashRate += 18;

    return { ok: true, message: `Rig #${miner.rigs} comprado com sucesso.` };
  }

  getMinerHashRate(miner) {
    if (!miner.active) {
      return 0;
    }

    // Deterministic hash rate based on base GHS and any active boosts
    return miner.baseHashRate * miner.boostMultiplier;
  }

  distributeRewards() {
    // Pool Mining Model: Distribute fixed block reward proportionally to all miners
    // based on their cumulative work (GHS * time) during this block period
    const minedBlockNumber = this.blockNumber;
    const totalWork = [...this.roundWork.values()].reduce((sum, value) => sum + value, 0);
    if (totalWork <= 0) {
      logger.debug("No work accumulated in round, skipping distribution", {
        blockNumber: minedBlockNumber
      });
      this.roundWork.forEach((_, minerId) => this.roundWork.set(minerId, 0));
      this.lastReward = 0;
      this.blockHistory.unshift({
        blockNumber: minedBlockNumber,
        reward: 0,
        minerCount: this.activeMiners,
        timestamp: Date.now()
      });

      if (this.blockHistory.length > 12) {
        this.blockHistory.length = 12;
      }

      this.blockNumber += 1;
      this.blockProgress = 0;
      this.lastBlockAt = Date.now();
      this.blockStartedAt = this.lastBlockAt;
      this.nextBlockAt = this.blockStartedAt + this.blockDurationMs;
      return;
    }

    // Fixed reward per block (0.1 POL)
    const blockReward = this.rewardBase;
    const minerRewards = [];

    // Snapshot previous balances for rollback if DB persistence fails
    const balanceSnapshot = new Map();

    for (const [minerId, work] of this.roundWork.entries()) {
      const miner = this.miners.get(minerId);
      if (!miner || work <= 0) {
        this.roundWork.set(minerId, 0);
        continue;
      }

      balanceSnapshot.set(minerId, { balance: miner.balance, lifetimeMined: miner.lifetimeMined });

      const share = work / totalWork;
      const reward = blockReward * share;
      miner.balance += reward;
      miner.lifetimeMined += reward;
      this.totalMinted += reward;
      this.roundWork.set(minerId, 0);

      minerRewards.push({
        minerId: miner.id,
        userId: miner.userId,
        username: miner.username,
        walletAddress: miner.walletAddress,
        rigs: miner.rigs,
        baseHashRate: miner.baseHashRate,
        workAccumulated: work,
        sharePercentage: share * 100,
        rewardAmount: reward,
        balanceAfter: miner.balance,
        lifetimeMined: miner.lifetimeMined,
        // Legacy reward logger fields
        work: work.toFixed(2),
        share: (share * 100).toFixed(2),
        reward: reward.toFixed(8),
        newBalance: miner.balance.toFixed(8)
      });
    }

    // Atomically persist rewards to DB. If it fails, roll back in-memory balances.
    if (this.persistBlockRewardsCallback && minerRewards.length > 0) {
      const now = Date.now();
      Promise.resolve(
        this.persistBlockRewardsCallback({
          blockNumber: minedBlockNumber,
          blockReward,
          totalWork,
          minerRewards,
          now
        })
      ).catch((error) => {
        logger.error("CRITICAL: Block reward persistence failed — rolling back in-memory balances", {
          blockNumber: minedBlockNumber,
          error: error.message
        });
        // Roll back miner balances to prevent divergence between memory and DB
        for (const [minerId, snapshot] of balanceSnapshot.entries()) {
          const miner = this.miners.get(minerId);
          if (miner) {
            const rewardEntry = minerRewards.find((r) => r.minerId === minerId);
            if (rewardEntry) {
              miner.balance = snapshot.balance;
              miner.lifetimeMined = snapshot.lifetimeMined;
              this.totalMinted -= rewardEntry.rewardAmount;
            }
          }
        }
      });
    }

    // Fire legacy per-miner reward logger (non-blocking, best-effort)
    if (this.logRewardCallback) {
      for (const r of minerRewards) {
        if (r.userId) {
          this.logRewardCallback({
            userId: r.userId,
            blockNumber: minedBlockNumber,
            workAccumulated: r.workAccumulated,
            totalNetworkWork: totalWork,
            sharePercentage: r.sharePercentage,
            rewardAmount: r.rewardAmount,
            balanceAfter: r.balanceAfter
          });
        }
      }
    }

    logger.info("Block rewards distributed", {
      blockNumber: minedBlockNumber,
      blockReward,
      totalWork: totalWork.toFixed(2),
      minerCount: minerRewards.length,
      totalDistributed: minerRewards.reduce((sum, r) => sum + r.rewardAmount, 0).toFixed(8)
    });

    this.lastReward = blockReward;
    this.blockHistory.unshift({
      blockNumber: minedBlockNumber,
      reward: blockReward,
      minerCount: this.activeMiners,
      timestamp: Date.now()
    });

    if (this.blockHistory.length > 12) {
      this.blockHistory.length = 12;
    }

    this.blockNumber += 1;
    this.blockProgress = 0;
    this.lastBlockAt = Date.now();
    this.blockStartedAt = this.lastBlockAt;
    this.nextBlockAt = this.blockStartedAt + this.blockDurationMs;
  }

  tick() {
    // Each second, accumulate work from each active miner based on their GHS
    const now = Date.now();

    let totalHashRate = 0;
    let activeMiners = 0;

    for (const [minerId, miner] of this.miners.entries()) {
      if (miner.boostEndsAt > 0 && now >= miner.boostEndsAt) {
        miner.boostMultiplier = 1;
        miner.boostEndsAt = 0;
      }

      const hashRate = this.getMinerHashRate(miner);
      totalHashRate += hashRate;
      if (hashRate > 0) {
        activeMiners += 1;
      }
      this.roundWork.set(minerId, (this.roundWork.get(minerId) || 0) + hashRate);
    }

    this.currentNetworkHashRate = totalHashRate;
    this.activeMiners = activeMiners;

    // Smooth price movement driven only by real demand (no random noise to avoid timing exploits)
    const demandFactor = totalHashRate > 0 ? 0.00015 : -0.00015;
    this.tokenPrice = Math.max(0.05, Math.min(999, this.tokenPrice + demandFactor));

    if (now >= this.nextBlockAt) {
      logger.info("Block time reached, distributing rewards", {
        blockNumber: this.blockNumber,
        activeMiners,
        totalHashRate: totalHashRate.toFixed(2),
        minerCount: this.miners.size
      });
      this.distributeRewards();
    }

    const elapsed = Math.max(0, now - this.blockStartedAt);
    this.blockProgress = Math.min(this.blockTarget, (elapsed / this.blockDurationMs) * this.blockTarget);
  }

  getLeaderboard(limit = 10) {
    return [...this.miners.values()]
      .map((miner) => ({
        id: miner.id,
        username: miner.username,
        rigs: miner.rigs,
        active: miner.active,
        lifetimeMined: miner.lifetimeMined,
        currentHashRate: this.getMinerHashRate(miner)
      }))
      .sort((a, b) => b.lifetimeMined - a.lifetimeMined)
      .slice(0, limit);
  }

  getPublicState(minerId) {
    const miner = minerId ? this.miners.get(minerId) : null;
    const remainingMs = Math.max(0, this.nextBlockAt - Date.now());
    const blockCountdownSeconds = Math.ceil(remainingMs / 1000);
    const blockEtaSeconds = blockCountdownSeconds;

    return {
      serverTime: Date.now(),
      tokenSymbol: this.tokenSymbol,
      tokenPrice: this.tokenPrice,
      blockReward: this.rewardBase,
      blockNumber: this.blockNumber,
      blockTarget: this.blockTarget,
      blockProgress: this.blockProgress,
      blockDurationSeconds: Math.round(this.blockDurationMs / 1000),
      blockCountdownSeconds,
      totalMiners: this.miners.size,
      activeMiners: this.activeMiners,
      networkHashRate: this.currentNetworkHashRate,
      totalMinted: this.totalMinted,
      lastReward: this.lastReward,
      blockEtaSeconds,
      blockHistory: this.blockHistory,
      leaderboard: this.getLeaderboard(),
      miner: miner
        ? {
          id: miner.id,
          username: miner.username,
          walletAddress: miner.walletAddress,
          rigs: miner.rigs,
          active: miner.active,
          baseHashRate: miner.baseHashRate,
          boostMultiplier: miner.boostMultiplier,
          boostEndsAt: miner.boostEndsAt,
          balance: miner.balance,
          lifetimeMined: miner.lifetimeMined,
          connected: miner.connected,
          estimatedHashRate: this.getMinerHashRate(miner)
        }
        : null
    };
  }
}

module.exports = { MiningEngine };
