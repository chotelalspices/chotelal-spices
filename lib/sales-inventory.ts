export type InventoryProduct = { id: string; availableInventory: number | null };

export type InventoryPoolIdentity = {
  formulationId: string;
  name: string;
  quantity: number;
  unit: string;
};

export function getInventoryPoolKey(product: InventoryPoolIdentity) {
  const normalizedName = product.name.trim().toLowerCase().replace(/\s+/g, " ");
  return [product.formulationId, normalizedName, product.quantity, product.unit.toLowerCase()].join("|");
}

export function reserveInventory(
  remainingByPool: Map<string, number>,
  poolKey: string,
  quantity: number,
) {
  const availableBefore = Math.max(0, remainingByPool.get(poolKey) ?? 0);
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > availableBefore) {
    return { valid: false, availableBefore, remaining: availableBefore };
  }
  const remaining = availableBefore - quantity;
  remainingByPool.set(poolKey, remaining);
  return { valid: true, availableBefore, remaining };
}

export function totalAvailableInventory(products: readonly InventoryProduct[]) {
  return products.reduce((sum, product) => sum + Math.max(0, product.availableInventory ?? 0), 0);
}

export function planFifoDeductions(products: readonly InventoryProduct[], quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Sale quantity must be a positive whole number.");
  }
  const available = totalAvailableInventory(products);
  if (quantity > available) {
    throw new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
  }
  let remaining = quantity;
  const deductions: Array<{ id: string; quantity: number }> = [];
  for (const product of products) {
    if (remaining === 0) break;
    const stock = Math.max(0, product.availableInventory ?? 0);
    const deduction = Math.min(stock, remaining);
    if (deduction > 0) deductions.push({ id: product.id, quantity: deduction });
    remaining -= deduction;
  }
  return deductions;
}

export async function deductInventoryFifo(tx: any, products: readonly InventoryProduct[], quantity: number) {
  const deductions = planFifoDeductions(products, quantity);
  for (const deduction of deductions) {
    const result = await tx.finishedProduct.updateMany({
      where: { id: deduction.id, availableInventory: { gte: deduction.quantity } },
      data: { availableInventory: { decrement: deduction.quantity } },
    });
    if (result.count !== 1) {
      throw new Error("Inventory changed while the sale was being saved. Please retry.");
    }
  }
  for (const deduction of deductions) {
    const product = products.find((item) => item.id === deduction.id);
    if (product) product.availableInventory = (product.availableInventory ?? 0) - deduction.quantity;
  }
  return deductions;
}
