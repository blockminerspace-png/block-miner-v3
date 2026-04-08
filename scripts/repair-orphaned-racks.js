/**
 * One-off repair: clear stale blocked_by_miner_id pointing at deleted user_miners,
 * and any user_miner_id that might reference missing rows (should not happen with FK).
 *
 * Usage: node scripts/repair-orphaned-racks.js
 * Requires DATABASE_URL (same as server).
 */
import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const existingIds = new Set(
    (await prisma.userMiner.findMany({ select: { id: true } })).map((r) => r.id)
  );

  const racks = await prisma.userRack.findMany({
    where: {
      OR: [{ blockedByMinerId: { not: null } }, { userMinerId: { not: null } }],
    },
    select: { id: true, userId: true, userMinerId: true, blockedByMinerId: true },
  });

  let clearedBlocked = 0;
  let clearedPrimary = 0;

  for (const r of racks) {
    if (r.blockedByMinerId != null && !existingIds.has(r.blockedByMinerId)) {
      await prisma.userRack.update({
        where: { id: r.id },
        data: { blockedByMinerId: null },
      });
      clearedBlocked += 1;
      console.log(`[repair] rack ${r.id} user ${r.userId}: cleared stale blockedByMinerId=${r.blockedByMinerId}`);
    }
    if (r.userMinerId != null && !existingIds.has(r.userMinerId)) {
      await prisma.userRack.update({
        where: { id: r.id },
        data: { userMinerId: null, installedAt: null },
      });
      clearedPrimary += 1;
      console.log(`[repair] rack ${r.id} user ${r.userId}: cleared stale userMinerId=${r.userMinerId}`);
    }
  }

  console.log(`[repair] done. clearedBlocked=${clearedBlocked} clearedPrimary=${clearedPrimary}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
