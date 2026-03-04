const { get, run } = require("./db");

const INTERNAL_SHORTLINK_TYPE = "internal";
const INTERNAL_REWARD_NAME = "Shortlink Reward 5 GHS";
const INTERNAL_REWARD_SLUG = "shortlink-5ghs-reward";
const INTERNAL_REWARD_HASH_RATE = 5;
const INTERNAL_REWARD_SLOT_SIZE = 1;
const INTERNAL_REWARD_IMAGE_URL = "/assets/machines/reward3.png";

async function ensureDefaultInternalReward() {
  const now = Date.now();

  let miner = await get(
    "SELECT id FROM miners WHERE slug = ?",
    [INTERNAL_REWARD_SLUG]
  );

  if (!miner) {
    const minerInsert = await run(
      "INSERT INTO miners (name, slug, base_hash_rate, price, slot_size, image_url, is_active, show_in_shop, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        INTERNAL_REWARD_NAME,
        INTERNAL_REWARD_SLUG,
        INTERNAL_REWARD_HASH_RATE,
        0,
        INTERNAL_REWARD_SLOT_SIZE,
        INTERNAL_REWARD_IMAGE_URL,
        1,
        0,
        now
      ]
    );
    miner = { id: minerInsert.lastID };
  } else {
    await run(
      "UPDATE miners SET name = ?, base_hash_rate = ?, price = ?, slot_size = ?, image_url = ?, is_active = 1, show_in_shop = 0 WHERE id = ?",
      [
        INTERNAL_REWARD_NAME,
        INTERNAL_REWARD_HASH_RATE,
        0,
        INTERNAL_REWARD_SLOT_SIZE,
        INTERNAL_REWARD_IMAGE_URL,
        miner.id
      ]
    );
  }

  const current = await get(
    "SELECT id FROM shortlink_rewards WHERE shortlink_type = ?",
    [INTERNAL_SHORTLINK_TYPE]
  );

  if (!current) {
    await run(
      "INSERT INTO shortlink_rewards (shortlink_type, miner_id, reward_name, hash_rate, slot_size, image_url, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        INTERNAL_SHORTLINK_TYPE,
        miner.id,
        INTERNAL_REWARD_NAME,
        INTERNAL_REWARD_HASH_RATE,
        INTERNAL_REWARD_SLOT_SIZE,
        INTERNAL_REWARD_IMAGE_URL,
        1,
        now,
        now
      ]
    );
  } else {
    await run(
      "UPDATE shortlink_rewards SET miner_id = ?, reward_name = ?, hash_rate = ?, slot_size = ?, image_url = ?, is_active = 1, updated_at = ? WHERE id = ?",
      [
        miner.id,
        INTERNAL_REWARD_NAME,
        INTERNAL_REWARD_HASH_RATE,
        INTERNAL_REWARD_SLOT_SIZE,
        INTERNAL_REWARD_IMAGE_URL,
        now,
        current.id
      ]
    );
  }
}

async function getActiveRewardByType(shortlinkType = INTERNAL_SHORTLINK_TYPE) {
  return get(
    `SELECT
      sr.id,
      sr.shortlink_type,
      sr.miner_id,
      sr.reward_name,
      sr.hash_rate,
      sr.slot_size,
      sr.image_url,
      sr.is_active,
      m.name as miner_name,
      m.slug as miner_slug,
      m.show_in_shop
     FROM shortlink_rewards sr
     LEFT JOIN miners m ON m.id = sr.miner_id
     WHERE sr.shortlink_type = ? AND sr.is_active = 1
     LIMIT 1`,
    [shortlinkType]
  );
}

module.exports = {
  ensureDefaultInternalReward,
  getActiveRewardByType,
  INTERNAL_SHORTLINK_TYPE,
  INTERNAL_REWARD_NAME,
  INTERNAL_REWARD_HASH_RATE,
  INTERNAL_REWARD_SLOT_SIZE,
  INTERNAL_REWARD_IMAGE_URL
};