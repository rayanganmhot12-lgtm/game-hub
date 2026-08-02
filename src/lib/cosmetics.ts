export interface CosmeticItem {
  id: string;
  type: "frame" | "badge" | "banner" | "membership";
  name: string;
  description: string;
  cost: number;
  // Never purchasable — granted automatically to the developer account only,
  // and hidden from the Store catalog for everyone else.
  adminOnly?: boolean;
}

// The one membership item — owning it (unlockedCosmetics includes "plus")
// is what gates uploading an animated GIF as an avatar or banner instead of
// the usual static resized photo. Checked server-side too, not just in the UI.
export const PLUS_ITEM_ID = "plus";

// A fixed, hand-picked catalog — not user-generated, not real money. Just a
// small reward loop for actually using the app.
export const COSMETIC_CATALOG: CosmeticItem[] = [
  {
    id: "frame-neon-pulse",
    type: "frame",
    name: "Neon Pulse Frame",
    description: "A pulsing accent-colored glow ring around your avatar.",
    cost: 250,
  },
  {
    id: "frame-gold",
    type: "frame",
    name: "Gold Frame",
    description: "A gold ring around your avatar.",
    cost: 400,
  },
  {
    id: "badge-pro",
    type: "badge",
    name: '"Pro" Badge',
    description: "A small badge next to your name in the navbar.",
    cost: 150,
  },
  {
    id: "badge-legend",
    type: "badge",
    name: '"Legend" Badge',
    description: "A fancier badge next to your name in the navbar.",
    cost: 350,
  },
  {
    id: "badge-hellokitty",
    type: "badge",
    name: '"Hello Kitty" Badge',
    description: "A cute pink badge next to your name.",
    cost: 300,
  },
  {
    id: "badge-developer",
    type: "badge",
    name: '"Dev" Badge',
    description: "Reserved for the developer account.",
    cost: 0,
    adminOnly: true,
  },
  {
    id: "badge-admin",
    type: "badge",
    name: '"Admin" Badge',
    description: "Granted by the developer account only.",
    cost: 0,
    adminOnly: true,
  },
  {
    id: "banner-shimmer",
    type: "banner",
    name: "Shimmer Banner",
    description: "A sweeping light shimmer across your profile banner.",
    cost: 300,
  },
  {
    id: "banner-aurora",
    type: "banner",
    name: "Aurora Banner",
    description: "A slow-shifting aurora gradient over your profile banner.",
    cost: 450,
  },
  {
    id: PLUS_ITEM_ID,
    type: "membership",
    name: "Game Hub Plus",
    description: "Animated GIF avatar/banner, a custom profile color, and 15% off everything else here.",
    cost: 1000,
  },
];

export function getCosmetic(id: string): CosmeticItem | undefined {
  return COSMETIC_CATALOG.find((c) => c.id === id);
}

// Plus members get a discount on every other cosmetic (not on Plus itself).
export const PLUS_DISCOUNT = 0.15;

export function priceFor(item: CosmeticItem, hasPlus: boolean): number {
  if (!hasPlus || item.id === PLUS_ITEM_ID) return item.cost;
  return Math.max(1, Math.round(item.cost * (1 - PLUS_DISCOUNT)));
}
