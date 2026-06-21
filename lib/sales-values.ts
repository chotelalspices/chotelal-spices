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

export function getUploadPriceError(price: number, totalAmount: number) {
  if (!Number.isFinite(price) || price < 0) return "Invalid or missing selling price";
  if (price === 0 && totalAmount > 0) {
    return "A zero-price product must also have a zero total amount";
  }
  return null;
}

export function isFreeUploadLine(price: number, totalAmount: number) {
  return price === 0 && totalAmount === 0;
}
