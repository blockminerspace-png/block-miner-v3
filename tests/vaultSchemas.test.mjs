import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moveToVaultBodySchema, retrieveFromVaultBodySchema } from "../server/utils/vaultSchemas.js";

describe("vaultSchemas", () => {
  it("moveToVaultBodySchema accepts inventory and rack", () => {
    assert.deepEqual(moveToVaultBodySchema.parse({ source: "inventory", itemId: 12 }), {
      source: "inventory",
      itemId: 12
    });
    assert.deepEqual(moveToVaultBodySchema.parse({ source: "rack", itemId: "5" }), {
      source: "rack",
      itemId: 5
    });
  });

  it("moveToVaultBodySchema rejects invalid source and extra keys", () => {
    assert.equal(moveToVaultBodySchema.safeParse({ source: "vault", itemId: 1 }).success, false);
    assert.equal(moveToVaultBodySchema.safeParse({ source: "inventory", itemId: 1, x: 1 }).success, false);
    assert.equal(moveToVaultBodySchema.safeParse({ source: "inventory", itemId: 0 }).success, false);
  });

  it("retrieveFromVaultBodySchema accepts inventory path", () => {
    assert.deepEqual(retrieveFromVaultBodySchema.parse({ destination: "inventory", vaultId: 3 }), {
      destination: "inventory",
      vaultId: 3
    });
  });

  it("retrieveFromVaultBodySchema requires slotIndex for rack", () => {
    assert.equal(retrieveFromVaultBodySchema.safeParse({ destination: "rack", vaultId: 1 }).success, false);
    assert.deepEqual(
      retrieveFromVaultBodySchema.parse({ destination: "rack", vaultId: 2, slotIndex: 10 }),
      { destination: "rack", vaultId: 2, slotIndex: 10 }
    );
  });

  it("retrieveFromVaultBodySchema rejects slotIndex out of range for rack", () => {
    assert.equal(
      retrieveFromVaultBodySchema.safeParse({ destination: "rack", vaultId: 1, slotIndex: 80 }).success,
      false
    );
  });
});
