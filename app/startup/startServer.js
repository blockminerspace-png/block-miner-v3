async function startServer({
  initializeDatabase,
  restoreMiningEngineState,
  walletModel,
  syncEngineMiners,
  serverDatabaseModel,
  publicStateService,
  startCronTasks,
  engine,
  io,
  persistMinerProfile,
  run,
  logger,
  server,
  port,
  getLocalIpv4Addresses
}) {
  await initializeDatabase();
  await restoreMiningEngineState();

  try {
    const result = await walletModel.failAllPendingWithdrawals();
    if (result.totalPending > 0) {
      logger.warn("Startup: marked pending withdrawals as failed", result);
    }
  } catch (error) {
    logger.error("Startup: failed to mark pending withdrawals as failed", { error: error.message });
  }

  await syncEngineMiners();

  try {
    const users = await serverDatabaseModel.listDistinctTempPowerUserIds();
    const userIds = users.map((user) => user.user_id);
    logger.info("Syncing baseHashRate for all users on startup", { userCount: userIds.length });
    await Promise.all(userIds.map((userId) => publicStateService.syncUserBaseHashRate(userId)));
    logger.info("BaseHashRate sync completed");
  } catch (error) {
    logger.error("Failed to sync baseHashRate on startup", { error: error.message });
  }

  const cronHandles = startCronTasks({
    engine,
    io,
    persistMinerProfile,
    run,
    buildPublicState: publicStateService.buildPublicState,
    syncEngineMiners,
    syncUserBaseHashRate: publicStateService.syncUserBaseHashRate
  });

  await new Promise((resolve) => {
    server.listen(port, "0.0.0.0", () => {
      logger.info(`BlockMiner server started on port ${port}`, { env: process.env.NODE_ENV });
      const localAddresses = getLocalIpv4Addresses();
      if (localAddresses.length) {
        for (const address of localAddresses) {
          logger.info(`BlockMiner LAN accessible at http://${address}:${port}`, { address });
        }
      } else {
        logger.warn("Unable to detect local IP address for LAN access");
      }
      resolve();
    });
  });

  return {
    cronHandles
  };
}

module.exports = {
  startServer
};
