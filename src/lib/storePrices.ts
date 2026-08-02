import { type CosmeticItem } from "@/lib/cosmetics";

// Pure pricing helpers, safe to import from client components. Anything that
// has to touch the settings file lives in storePricesServer.ts instead —
// same split as friendCode.ts / friendCodeServer.ts.

// Generous but finite — keeps a fat-fingered edit (or junk on the relay)
// from making an item cost more than anyone could ever earn.
export const MAX_STORE_PRICE = 1_000_000;

export function isValidPrice(cost: unknown): cost is number {
  return typeof cost === "number" && Number.isInteger(cost) && cost >= 0 && cost <= MAX_STORE_PRICE;
}

// Applies the developer's price overrides on top of the built-in catalog.
// Overriding `cost` here (rather than at each call site) means everything
// downstream — the Plus discount in priceFor, the purchase route's balance
// check, the Store UI — keeps working with no further changes.
export function applyPriceOverrides(
  catalog: CosmeticItem[],
  overrides: Record<string, number> | undefined
): CosmeticItem[] {
  if (!overrides) return catalog;
  return catalog.map((item) => (isValidPrice(overrides[item.id]) ? { ...item, cost: overrides[item.id]! } : item));
}
