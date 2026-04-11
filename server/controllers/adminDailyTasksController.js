import prisma from "../src/db/prisma.js";

export async function listDefinitions(_req, res) {
  try {
    const rows = await prisma.dailyTaskDefinition.findMany({
      orderBy: { sortOrder: "asc" }
    });
    res.json({ ok: true, definitions: rows });
  } catch (e) {
    console.error("adminDailyTasks listDefinitions", e);
    res.status(500).json({ ok: false, message: "Failed to load daily task definitions." });
  }
}

/**
 * Partial update: `isActive` and/or `sortOrder` (validated).
 */
export async function patchDefinition(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ ok: false, message: "Invalid task id." });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const data = {};
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }
    if (body.sortOrder !== undefined && body.sortOrder !== null) {
      const n = parseInt(String(body.sortOrder), 10);
      if (!Number.isInteger(n) || n < 0 || n > 99999) {
        return res.status(400).json({ ok: false, message: "Invalid sort order." });
      }
      data.sortOrder = n;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, message: "No valid fields to update." });
    }
    await prisma.dailyTaskDefinition.update({ where: { id }, data });
    const row = await prisma.dailyTaskDefinition.findUnique({ where: { id } });
    res.json({ ok: true, definition: row });
  } catch (e) {
    if (e?.code === "P2025") {
      return res.status(404).json({ ok: false, message: "Task definition not found." });
    }
    console.error("adminDailyTasks patchDefinition", e);
    res.status(500).json({ ok: false, message: "Failed to update daily task definition." });
  }
}
