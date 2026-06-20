export function parseAuthoritativeUploadAmount(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    throw new Error("Excel total amount is required.");
  }
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Excel total amount must be a non-negative number.");
  }
  return amount;
}