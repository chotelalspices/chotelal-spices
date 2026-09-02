export const BATCH_NUMBER_PREFIX = "BATCH";

export function formatBatchNumber(year: number, sequence: number): string {
  return `${BATCH_NUMBER_PREFIX}-${year}-${String(sequence).padStart(3, "0")}`;
}

// Minimal shape of the Prisma (or transaction) client this needs -
// just tagged-template $queryRaw, so it can be driven by prisma,
// tx, or a fake in-memory client in tests.
export type BatchCounterClient = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

// Atomically allocates the next batch sequence number for a given year
// and returns the formatted batch number (e.g. "BATCH-2026-1000").
//
// Uses a single "INSERT ... ON CONFLICT (year) DO UPDATE ... RETURNING"
// statement against ProductionBatchCounter. Postgres takes a row lock
// for the conflicting row, so concurrent callers allocating for the
// same year are serialized and always receive distinct, strictly
// increasing sequence numbers - unlike computing "last batch + 1" in
// application code, which is racy and (when ordering by batchNumber as
// text) breaks once the sequence crosses from 3 to 4 digits.
export async function allocateBatchNumber(
  client: BatchCounterClient,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const rows = await client.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "ProductionBatchCounter" ("year", "lastNumber")
    VALUES (${year}, 1)
    ON CONFLICT ("year")
    DO UPDATE SET "lastNumber" = "ProductionBatchCounter"."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  const sequence = rows[0]?.lastNumber;
  if (typeof sequence !== "number") {
    throw new Error("Failed to allocate a production batch number.");
  }
  return formatBatchNumber(year, sequence);
}
