import prisma from "../src/db/prisma.js";

/**
 * Read-only list of daily task definitions (seeded by migration; editable via DB / future CRUD).
 */
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
