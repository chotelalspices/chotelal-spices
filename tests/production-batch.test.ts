import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node test runner requires explicit TypeScript extensions.
import { allocateBatchNumber, formatBatchNumber, type BatchCounterClient } from "../lib/production-batch.ts";

// Fakes the ProductionBatchCounter row's atomic
// "INSERT ... ON CONFLICT (year) DO UPDATE ... RETURNING" statement.
// Calls for the same underlying table are queued one after another,
// mirroring the row lock Postgres holds on the conflicting row for the
// duration of each transaction - which is what makes concurrent callers
// receive distinct, strictly increasing sequence numbers in production.
function createFakeCounterClient(seed: Record<number, number> = {}): {
  client: BatchCounterClient;
  counters: Map<number, number>;
} {
  const counters = new Map<number, number>(
    Object.entries(seed).map(([year, lastNumber]) => [Number(year), lastNumber])
  );
  let queue: Promise<unknown> = Promise.resolve();

  const client: BatchCounterClient = {
    $queryRaw<T>(_strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
      const year = values[0] as number;
      const run = () => {
        const next = (counters.get(year) ?? 0) + 1;
        counters.set(year, next);
        return [{ lastNumber: next }] as unknown as T;
      };
      const result = queue.then(run);
      queue = result.catch(() => undefined);
      return result;
    },
  };

  return { client, counters };
}

test("formats batch numbers, padding to 3 digits but never truncating beyond that", () => {
  assert.equal(formatBatchNumber(2026, 1), "BATCH-2026-001");
  assert.equal(formatBatchNumber(2026, 999), "BATCH-2026-999");
  assert.equal(formatBatchNumber(2026, 1000), "BATCH-2026-1000");
  assert.equal(formatBatchNumber(2026, 1001), "BATCH-2026-1001");
});

test("allocates sequential batch numbers starting at 1 for a new year", async () => {
  const { client } = createFakeCounterClient();
  assert.equal(await allocateBatchNumber(client, 2026), "BATCH-2026-001");
  assert.equal(await allocateBatchNumber(client, 2026), "BATCH-2026-002");
  assert.equal(await allocateBatchNumber(client, 2026), "BATCH-2026-003");
});

test("continues past 999 -> 1000 without regenerating the same number", async () => {
  // Reproduces the reported production state: 999 batches already exist
  // for 2026. The old implementation ordered batchNumber as text, under
  // which "BATCH-2026-999" sorts after "BATCH-2026-1000", so it kept
  // reading 999 as the "latest" batch and regenerating BATCH-2026-1000
  // forever. The counter-based allocator must not repeat 1000.
  const { client } = createFakeCounterClient({ 2026: 999 });
  assert.equal(await allocateBatchNumber(client, 2026), "BATCH-2026-1000");
  assert.equal(await allocateBatchNumber(client, 2026), "BATCH-2026-1001");
  assert.equal(await allocateBatchNumber(client, 2026), "BATCH-2026-1002");
});

test("hands out unique, gapless batch numbers to concurrent requests", async () => {
  const { client } = createFakeCounterClient({ 2026: 999 });
  const results = await Promise.all(
    Array.from({ length: 10 }, () => allocateBatchNumber(client, 2026))
  );

  assert.equal(new Set(results).size, 10, "all 10 batch numbers must be unique");
  assert.deepEqual(
    [...results].sort(),
    [
      "BATCH-2026-1000",
      "BATCH-2026-1001",
      "BATCH-2026-1002",
      "BATCH-2026-1003",
      "BATCH-2026-1004",
      "BATCH-2026-1005",
      "BATCH-2026-1006",
      "BATCH-2026-1007",
      "BATCH-2026-1008",
      "BATCH-2026-1009",
    ]
  );
});

test("resets numbering for a new year independently of other years", async () => {
  const { client } = createFakeCounterClient({ 2026: 5 });
  assert.equal(await allocateBatchNumber(client, 2027), "BATCH-2027-001");
  assert.equal(await allocateBatchNumber(client, 2027), "BATCH-2027-002");
  // 2026's counter is untouched by 2027 allocations.
  assert.equal(await allocateBatchNumber(client, 2026), "BATCH-2026-006");
});
