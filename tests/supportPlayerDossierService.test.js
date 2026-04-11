import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSupportTicketPlayerDossier,
  parseDossierPagination,
  toNumberOrNull,
} from "../server/services/supportPlayerDossierService.js";

describe("toNumberOrNull", () => {
  it("maps decimals and null", () => {
    assert.equal(toNumberOrNull(null), null);
    assert.equal(toNumberOrNull("12.5"), 12.5);
    assert.equal(toNumberOrNull(3), 3);
  });
});

describe("parseDossierPagination", () => {
  it("clamps limit and normalizes pages", () => {
    const p = parseDossierPagination({ limit: "200", depositsPage: "-1", withdrawalsPage: "2" });
    assert.equal(p.limit, 80);
    assert.equal(p.depositsPage, 1);
    assert.equal(p.withdrawalsPage, 2);
  });

  it("parses inventory and vault pages", () => {
    const p = parseDossierPagination({ inventoryPage: "3", vaultPage: "1" });
    assert.equal(p.inventoryPage, 3);
    assert.equal(p.vaultPage, 1);
  });
});

describe("getSupportTicketPlayerDossier", () => {
  it("returns NOT_FOUND when ticket missing", async () => {
    const prisma = {
      supportMessage: { findUnique: async () => null },
    };
    const r = await getSupportTicketPlayerDossier(prisma, 99, {});
    assert.equal(r.ok, false);
    assert.equal(r.code, "NOT_FOUND");
  });

  it("returns linked false when ticket has no userId", async () => {
    const prisma = {
      supportMessage: {
        findUnique: async () => ({
          id: 5,
          userId: null,
          name: "Guest",
          email: "g@example.com",
        }),
      },
    };
    const r = await getSupportTicketPlayerDossier(prisma, 5, {});
    assert.equal(r.ok, true);
    assert.equal(r.linked, false);
    assert.equal(r.dossier, null);
    assert.equal(r.ticket.email, "g@example.com");
  });

  it("returns orphanTicket when user row missing", async () => {
    const prisma = {
      supportMessage: {
        findUnique: async () => ({
          id: 2,
          userId: 404,
          name: "X",
          email: "x@y.z",
        }),
      },
      user: { findUnique: async () => null },
    };
    const r = await getSupportTicketPlayerDossier(prisma, 2, {});
    assert.equal(r.ok, true);
    assert.equal(r.linked, true);
    assert.equal(r.orphanTicket, true);
    assert.equal(r.dossier, null);
  });
});
