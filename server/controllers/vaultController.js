import * as vaultModel from "../models/vaultModel.js";
import * as inventoryModel from "../models/inventoryModel.js";
import { syncUserBaseHashRate } from "../models/minerProfileModel.js";
import { getMiningEngine } from "../src/miningEngineInstance.js";
import { createNotification } from "./notificationController.js";
import prisma from "../src/db/prisma.js";
import { releaseUserMinerFromRacksTx } from "../utils/rackMinerRelease.js";

/**
 * user_vault.miner_id FK → miners.id. Stale catalog rows would make inserts fail (P2003).
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {number | null | undefined} minerId
 * @returns {Promise<number | null>}
 */
async function safeVaultMinerId(tx, minerId) {
  const id = minerId == null ? null : Number(minerId);
  if (!Number.isInteger(id) || id < 1) return null;
  const row = await tx.miner.findUnique({ where: { id }, select: { id: true } });
  return row ? id : null;
}

export async function getVault(req, res) {
  try {
    const vault = await vaultModel.listVault(req.user.id);
    res.json({ ok: true, vault });
  } catch (error) {
    console.error("Vault Error:", error);
    res.status(500).json({ ok: false, message: "Unable to load vault." });
  }
}

export async function moveToVault(req, res) {
  try {
    const { source, itemId } = req.body;

    if (!source || !itemId) {
      return res.status(400).json({ ok: false, message: "Source and itemId are required." });
    }

    const now = new Date();

    if (source === 'inventory') {
      // Move from inventory to vault
      const inventoryItem = await inventoryModel.getInventoryItem(req.user.id, itemId);
      if (!inventoryItem) {
        return res.status(404).json({ ok: false, message: "Item not found in inventory." });
      }

      await prisma.$transaction(async (tx) => {
        const minerId = await safeVaultMinerId(tx, inventoryItem.minerId);
        await tx.userVault.create({
          data: {
            userId: req.user.id,
            minerId,
            minerName: inventoryItem.minerName,
            level: inventoryItem.level,
            hashRate: inventoryItem.hashRate,
            slotSize: inventoryItem.slotSize,
            imageUrl: inventoryItem.imageUrl,
            storedAt: now
          }
        });

        // Remove from inventory
        await tx.userInventory.delete({
          where: { id: itemId, userId: req.user.id }
        });
      });

    } else if (source === 'rack') {
      // Move from rack to vault
      const userMiner = await prisma.userMiner.findFirst({
        where: {
          id: itemId,
          userId: req.user.id
        },
        include: { miner: true }
      });

      if (!userMiner) {
        return res.status(404).json({ ok: false, message: "Machine not found in rack." });
      }

      await prisma.$transaction(async (tx) => {
        await releaseUserMinerFromRacksTx(tx, req.user.id, userMiner.id);
        const minerId = await safeVaultMinerId(tx, userMiner.minerId);
        await tx.userVault.create({
          data: {
            userId: req.user.id,
            minerId,
            minerName: userMiner.miner?.name || "Miner",
            level: userMiner.level,
            hashRate: userMiner.hashRate,
            slotSize: userMiner.slotSize,
            imageUrl: userMiner.imageUrl || userMiner.miner?.imageUrl || null,
            storedAt: now
          }
        });

        // Remove from rack
        await tx.userMiner.delete({
          where: { id: itemId, userId: req.user.id }
        });
      });

      // Update mining profile after removing from rack
      await syncUserBaseHashRate(req.user.id);
      const engine = getMiningEngine();
      if (engine) {
        await engine.reloadMinerProfile(req.user.id);
      }

    } else {
      return res.status(400).json({ ok: false, message: "Invalid source. Must be 'inventory' or 'rack'." });
    }

    // Create notification
    const engine = getMiningEngine();
    if (engine) {
      await createNotification({
        userId: req.user.id,
        title: "Máquina Guardada no Vault",
        message: "Sua máquina foi movida com segurança para o vault.",
        type: "info",
        io: engine.io
      });
    }

    res.json({ ok: true, message: "Machine moved to vault successfully!" });

  } catch (error) {
    const code = error?.code;
    const meta = error?.meta;
    console.error("Move to Vault Error:", { code, message: error?.message, meta });
    if (code === "P2003" || code === "P2014") {
      return res.status(409).json({
        ok: false,
        message: "Machine is still linked to a rack. Refresh the page and try again."
      });
    }
    res.status(500).json({ ok: false, message: "Internal server error during vault storage." });
  }
}

export async function retrieveFromVault(req, res) {
  try {
    const { destination, vaultId } = req.body;

    if (!destination || !vaultId) {
      return res.status(400).json({ ok: false, message: "Destination and vaultId are required." });
    }

    const vaultItem = await vaultModel.getVaultItem(req.user.id, vaultId);
    if (!vaultItem) {
      return res.status(404).json({ ok: false, message: "Item not found in vault." });
    }

    const now = new Date();

    if (destination === 'inventory') {
      await prisma.$transaction(async (tx) => {
        const minerId = await safeVaultMinerId(tx, vaultItem.minerId);
        await tx.userInventory.create({
          data: {
            userId: req.user.id,
            minerId,
            minerName: vaultItem.minerName,
            level: vaultItem.level,
            hashRate: vaultItem.hashRate,
            slotSize: vaultItem.slotSize,
            imageUrl: vaultItem.imageUrl,
            acquiredAt: now
          }
        });

        // Remove from vault
        await tx.userVault.delete({
          where: { id: vaultId, userId: req.user.id }
        });
      });

    } else if (destination === 'rack') {
      // Move from vault to rack
      const slotIndex = Number(req.body?.slotIndex);
      if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 80) {
        return res.status(400).json({ ok: false, message: "Invalid slot position." });
      }

      const slotSize = Number(vaultItem.slotSize || 1);

      if (slotSize === 2 && slotIndex % 2 !== 0) {
        return res.status(400).json({ ok: false, message: "Large machines must start on an even slot (1, 3, 5, 7 on UI)." });
      }

      const targetSlots = Array.from({ length: slotSize }, (_, i) => slotIndex + i);
      const existingMachines = await prisma.userMiner.findMany({
        where: {
          userId: req.user.id,
          slotIndex: { in: targetSlots }
        },
        include: { miner: true }
      });

      await prisma.$transaction(async (tx) => {
        if (existingMachines.length > 0) {
          for (const m of existingMachines) {
            await releaseUserMinerFromRacksTx(tx, req.user.id, m.id);
            await tx.userInventory.create({
              data: {
                userId: req.user.id,
                minerName: m.miner?.name || m.minerName || 'Miner',
                level: m.level,
                hashRate: m.hashRate,
                slotSize: m.slotSize,
                minerId: m.minerId || null,
                imageUrl: m.imageUrl || m.miner?.imageUrl || null,
                acquiredAt: now
              }
            });
            await tx.userMiner.delete({ where: { id: m.id } });
          }
        }

        const minerId = await safeVaultMinerId(tx, vaultItem.minerId);
        await tx.userMiner.create({
          data: {
            userId: req.user.id,
            slotIndex,
            level: vaultItem.level,
            hashRate: vaultItem.hashRate,
            isActive: true,
            slotSize,
            minerId,
            imageUrl: vaultItem.imageUrl
          }
        });

        // Remove from vault
        await tx.userVault.delete({
          where: { id: vaultId, userId: req.user.id }
        });
      });

      // Update mining profile after installing in rack
      await syncUserBaseHashRate(req.user.id);
      const engine = getMiningEngine();
      if (engine) {
        await engine.reloadMinerProfile(req.user.id);
      }

    } else {
      return res.status(400).json({ ok: false, message: "Invalid destination. Must be 'inventory' or 'rack'." });
    }

    // Create notification
    const engine = getMiningEngine();
    if (engine) {
      await createNotification({
        userId: req.user.id,
        title: "Máquina Retirada do Vault",
        message: "Sua máquina foi retirada do vault com sucesso.",
        type: "success",
        io: engine.io
      });
    }

    res.json({ ok: true, message: "Machine retrieved from vault successfully!" });

  } catch (error) {
    console.error("Retrieve from Vault Error:", error);
    res.status(500).json({ ok: false, message: "Internal server error during vault retrieval." });
  }
}