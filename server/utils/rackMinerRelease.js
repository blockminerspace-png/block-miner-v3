/**
 * When a UserMiner row is removed outside the rooms uninstall flow, user_racks
 * still references it (FK ON DELETE SET NULL on user_miner_id, but blocked_by_miner_id
 * has no FK). Clear both so racks stay consistent.
 */
export async function releaseUserMinerFromRacksTx(tx, userId, userMinerId) {
  await tx.userRack.updateMany({
    where: { userId, userMinerId },
    data: { userMinerId: null, installedAt: null },
  });
  await tx.userRack.updateMany({
    where: { userId, blockedByMinerId: userMinerId },
    data: { blockedByMinerId: null },
  });
}
