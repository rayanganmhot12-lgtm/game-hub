import { COSMETIC_CATALOG, type CosmeticItem } from "@/lib/cosmetics";
import { readInstallSettings } from "@/lib/installSettings";
import { applyPriceOverrides } from "@/lib/storePrices";

// Server-only: reads the settings file, so this can't be imported from a
// client component (fs isn't available in the browser bundle). The pure
// helpers live in storePrices.ts for that.
export function getPricedCatalog(): CosmeticItem[] {
  return applyPriceOverrides(COSMETIC_CATALOG, readInstallSettings().storePrices);
}
