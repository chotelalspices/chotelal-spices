import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node test runner requires explicit TypeScript extensions.
import { deductInventoryFifo, planFifoDeductions, totalAvailableInventory } from "../lib/sales-inventory.ts";
// @ts-expect-error Node test runner requires explicit TypeScript extensions.
import { parseAuthoritativeUploadAmount } from "../lib/sales-values.ts";

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