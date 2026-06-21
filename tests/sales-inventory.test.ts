import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node test runner requires explicit TypeScript extensions.
import { deductInventoryFifo, getInventoryPoolKey, planFifoDeductions, reserveInventory, totalAvailableInventory } from "../lib/sales-inventory.ts";
// @ts-expect-error Node test runner requires explicit TypeScript extensions.
import { getUploadPriceError, isFreeUploadLine, parseAuthoritativeUploadAmount } from "../lib/sales-values.ts";

test("deducts a sale across FIFO inventory pools without going negative", () => {
  const pools = [
    { id: "A", availableInventory: 50 },
    { id: "B", availableInventory: 30 },
    { id: "C", availableInventory: 20 },
  ];
  assert.equal(totalAvailableInventory(pools), 100);
  assert.deepEqual(planFifoDeductions(pools, 70), [
    { id: "A", quantity: 50 },
    { id: "B", quantity: 20 },
  ]);
});

test("rejects a sale larger than aggregate inventory", () => {
  assert.throws(
    () => planFifoDeductions([{ id: "A", availableInventory: 5 }], 6),
    /Insufficient stock/,
  );
});

test("uses the uploaded total verbatim instead of quantity times price", () => {
  const quantity = 10;
  const price = 25;
  const excelTotal = 199.5;
  assert.notEqual(excelTotal, quantity * price);
  assert.equal(parseAuthoritativeUploadAmount(excelTotal), 199.5);
});

test("requires an explicit valid Excel total", () => {
  assert.throws(() => parseAuthoritativeUploadAmount(undefined), /required/);
  assert.throws(() => parseAuthoritativeUploadAmount(-1), /non-negative/);
});
test("applies each FIFO deduction atomically and updates the in-memory pool", async () => {
  const pools = [
    { id: "A", availableInventory: 50 },
    { id: "B", availableInventory: 30 },
    { id: "C", availableInventory: 20 },
  ];
  const updates: unknown[] = [];
  const tx = {
    finishedProduct: {
      updateMany: async (operation: unknown) => {
        updates.push(operation);
        return { count: 1 };
      },
    },
  };
  await deductInventoryFifo(tx, pools, 70);
  assert.deepEqual(pools.map((pool) => pool.availableInventory), [0, 10, 20]);
  assert.equal(updates.length, 2);
});

test("uses one canonical pool for duplicate IDs of the same retail product", () => {
  const first = getInventoryPoolKey({
    formulationId: "garam",
    name: " Garam   Masala 500gm ",
    quantity: 500,
    unit: "gm",
  });
  const duplicate = getInventoryPoolKey({
    formulationId: "garam",
    name: "garam masala 500GM",
    quantity: 500,
    unit: "GM",
  });
  assert.equal(first, duplicate);
});

test("keeps different formulations and packet sizes in separate pools", () => {
  const base = { formulationId: "garam", name: "Garam Masala", quantity: 500, unit: "gm" };
  assert.notEqual(
    getInventoryPoolKey(base),
    getInventoryPoolKey({ ...base, formulationId: "garam-premium" }),
  );
  assert.notEqual(
    getInventoryPoolKey(base),
    getInventoryPoolKey({ ...base, quantity: 1000, unit: "gm" }),
  );
});

test("reserves preview stock cumulatively in row order", () => {
  const remaining = new Map([["pool", 100]]);
  assert.deepEqual(reserveInventory(remaining, "pool", 70), {
    valid: true,
    availableBefore: 100,
    remaining: 30,
  });
  assert.deepEqual(reserveInventory(remaining, "pool", 40), {
    valid: false,
    availableBefore: 30,
    remaining: 30,
  });
});

test("accepts a genuine free product and rejects contradictory zero pricing", () => {
  assert.equal(getUploadPriceError(0, 0), null);
  assert.equal(isFreeUploadLine(0, 0), true);
  assert.match(getUploadPriceError(0, 10) || "", /zero total amount/);
  assert.match(getUploadPriceError(Number.NaN, 0) || "", /missing selling price/);
});
