import prisma from "../src/db/prisma.js";
import {
  buildDefaultSidebarEntries,
  CATEGORY_TITLE_KEYS,
  coerceParentLockedSidebarEntries,
  SIDEBAR_ITEM_REGISTRY,
  SIDEBAR_SECTIONS,
  validateSidebarEntriesPayload
} from "./sidebarNavRegistry.js";

const SINGLETON_ID = 1;

/**
 * @param {object[]} entries
 * @returns {object[]}
 */
export function buildResolvedCategories(entries) {
  const byId = new Map(entries.map((e) => [e.itemId, e]));

  const isGroupVisible = byId.get("rewards_group")?.visible === true;

  /** @param {string} id */
  function rowVisible(id) {
    const e = byId.get(id);
    return Boolean(e?.visible);
  }

  /** @param {{ itemId: string, visible: boolean, parentItemId: string | null, section: string }} entry */
  function isShown(entry) {
    if (!entry.visible) return false;
    if (entry.parentItemId === "rewards_group") return isGroupVisible;
    return true;
  }

  const active = entries.filter(isShown);

  /**
   * @param {'main'|'earn'|'social'} section
   */
  function rowsForSection(section) {
    const roots = active.filter((e) => e.section === section && e.parentItemId === null);
    roots.sort((a, b) => a.sortOrder - b.sortOrder);
    return roots.map((root) => {
      const def = SIDEBAR_ITEM_REGISTRY[root.itemId];
      if (def?.isGroup) {
        const children = active
          .filter((e) => e.parentItemId === root.itemId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return {
          itemId: root.itemId,
          labelKey: def.labelKey,
          icon: def.icon,
          children: children.map((c) => {
            const cdef = SIDEBAR_ITEM_REGISTRY[c.itemId];
            return {
              itemId: c.itemId,
              labelKey: cdef.labelKey,
              icon: cdef.icon,
              path: cdef.path
            };
          })
        };
      }
      return {
        itemId: root.itemId,
        labelKey: def.labelKey,
        icon: def.icon,
        path: def.path
      };
    });
  }

  return SIDEBAR_SECTIONS.map((section) => ({
    section,
    titleKey: CATEGORY_TITLE_KEYS[section],
    items: rowsForSection(section)
  }));
}

async function ensureRow() {
  let row = await prisma.sidebarNavConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    const defaults = buildDefaultSidebarEntries();
    row = await prisma.sidebarNavConfig.create({
      data: { id: SINGLETON_ID, entries: defaults }
    });
  }
  return row;
}

/**
 * @returns {Promise<{ entries: object[], categories: object[] }>}
 */
export async function getSidebarNavForAdmin() {
  const row = await ensureRow();
  const raw = Array.isArray(row.entries) ? row.entries : [];
  const { entries: coerced, changed } = coerceParentLockedSidebarEntries(raw);
  if (changed) {
    await prisma.sidebarNavConfig.update({
      where: { id: SINGLETON_ID },
      data: { entries: coerced }
    });
  }
  const parsed = validateSidebarEntriesPayload(coerced);
  if (!parsed.ok) {
    const defaults = buildDefaultSidebarEntries();
    await prisma.sidebarNavConfig.update({
      where: { id: SINGLETON_ID },
      data: { entries: defaults }
    });
    return { entries: defaults, categories: buildResolvedCategories(defaults) };
  }
  return {
    entries: parsed.entries,
    categories: buildResolvedCategories(parsed.entries)
  };
}

/**
 * @returns {Promise<object[]>}
 */
export async function getSidebarNavCategoriesPublic() {
  const { categories } = await getSidebarNavForAdmin();
  return categories;
}

/**
 * @param {unknown} bodyEntries
 * @returns {Promise<{ ok: true, entries: object[], categories: object[] } | { ok: false, code: string }>}
 */
export async function saveSidebarNavEntries(bodyEntries) {
  const raw = Array.isArray(bodyEntries) ? bodyEntries : [];
  const { entries: coerced } = coerceParentLockedSidebarEntries(raw);
  const v = validateSidebarEntriesPayload(coerced);
  if (!v.ok) return { ok: false, code: v.code };
  await ensureRow();
  await prisma.sidebarNavConfig.update({
    where: { id: SINGLETON_ID },
    data: { entries: v.entries }
  });
  return { ok: true, entries: v.entries, categories: buildResolvedCategories(v.entries) };
}
