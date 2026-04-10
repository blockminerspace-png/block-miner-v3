/**
 * Sidebar nav registry validation and resolved tree (no DB).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  validateSidebarEntriesPayload,
  buildDefaultSidebarEntries,
  coerceParentLockedSidebarEntries
} from "../server/services/sidebarNavRegistry.js";
import { buildResolvedCategories } from "../server/services/sidebarNavService.js";

test("default entries pass validation", () => {
  const d = buildDefaultSidebarEntries();
  const v = validateSidebarEntriesPayload(d);
  assert.equal(v.ok, true);
});

test("rejects unknown itemId", () => {
  const d = buildDefaultSidebarEntries();
  d[0] = { ...d[0], itemId: "invalid_item" };
  const v = validateSidebarEntriesPayload(d);
  assert.equal(v.ok, false);
});

test("rejects parent_locked violation for check-in", () => {
  const d = buildDefaultSidebarEntries();
  const i = d.findIndex((x) => x.itemId === "checkin");
  assert.ok(i >= 0);
  d[i] = { ...d[i], parentItemId: "rewards_group" };
  const v = validateSidebarEntriesPayload(d);
  assert.equal(v.ok, false);
  assert.equal(v.code, "parent_locked");
});

test("hiding rewards group removes nested earn items from resolved nav", () => {
  const d = buildDefaultSidebarEntries().map((e) => {
    if (e.itemId === "rewards_group" || e.parentItemId === "rewards_group") {
      return { ...e, visible: false };
    }
    return e;
  });
  const cats = buildResolvedCategories(d);
  const earn = cats.find((c) => c.section === "earn");
  const flatPaths = earn.items.flatMap((x) =>
    x.children ? x.children.map((c) => c.path) : [x.path]
  );
  assert.ok(!flatPaths.includes("/faucet"));
});

test("coerceParentLockedSidebarEntries moves mini_pass out of rewards_group in stored rows", () => {
  const d = buildDefaultSidebarEntries();
  const i = d.findIndex((x) => x.itemId === "mini_pass");
  assert.ok(i >= 0);
  d[i] = { ...d[i], parentItemId: "rewards_group" };
  const { entries, changed } = coerceParentLockedSidebarEntries(d);
  assert.equal(changed, true);
  const mini = entries.find((x) => x.itemId === "mini_pass");
  assert.equal(mini.parentItemId, null);
  const v = validateSidebarEntriesPayload(entries);
  assert.equal(v.ok, true);
});

test("mini_pass is a top-level earn link in default resolved nav", () => {
  const d = buildDefaultSidebarEntries();
  const cats = buildResolvedCategories(d);
  const earn = cats.find((c) => c.section === "earn");
  const mini = earn.items.find((x) => x.itemId === "mini_pass");
  assert.ok(mini);
  assert.equal(mini.path, "/mini-pass");
});
