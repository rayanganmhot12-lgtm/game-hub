import { ReactNode } from "react";
import type { CosmeticItem } from "@/lib/cosmetics";
import NebulaScene from "@/components/NebulaScene";

const FRAME_CLASSES: Record<string, string> = {
  "frame-gold": "frame-gold",
  "frame-neon-pulse": "frame-neon-pulse",
};

export function CosmeticFrame({ frameId, children }: { frameId?: string | null; children: ReactNode }) {
  if (!frameId || !FRAME_CLASSES[frameId]) return <>{children}</>;
  return <div className={FRAME_CLASSES[frameId]}>{children}</div>;
}

const BADGE_LABELS: Record<string, { label: string; className: string }> = {
  "badge-pro": { label: "PRO", className: "badge-pro" },
  "badge-legend": { label: "LEGEND", className: "badge-legend" },
  "badge-hellokitty": { label: "🎀 HELLO KITTY", className: "badge-hellokitty" },
  // Reserved — not purchasable in the Store, only ever granted automatically
  // to the developer account (see src/lib/devBadge.ts).
  "badge-developer": { label: "DEV", className: "badge-developer" },
  "badge-admin": { label: "ADMIN", className: "badge-admin" },
};

export function CosmeticBadge({ badgeId }: { badgeId?: string | null }) {
  if (!badgeId || !BADGE_LABELS[badgeId]) return null;
  const badge = BADGE_LABELS[badgeId];
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${badge.className}`}>
      {badge.label}
    </span>
  );
}

const BANNER_CLASSES: Record<string, string> = {
  "banner-shimmer": "banner-shimmer",
  "banner-aurora": "banner-aurora",
  "banner-neon-glow": "banner-neon-glow",
};

export function CosmeticBanner({ bannerId, children }: { bannerId?: string | null; children: ReactNode }) {
  // Drawn as real shapes (see NebulaScene) instead of a CSS-class overlay —
  // it needs actual elements, not just a background effect, to read as a
  // small illustration rather than a color wash over the real banner photo.
  if (bannerId === "banner-nebula") {
    return (
      <div className="relative overflow-hidden">
        {children}
        <NebulaScene />
      </div>
    );
  }
  if (!bannerId || !BANNER_CLASSES[bannerId]) return <>{children}</>;
  return <div className={`relative overflow-hidden ${BANNER_CLASSES[bannerId]}`}>{children}</div>;
}

// A small swatch for any owned cosmetic — same visual treatment as the
// Store's own item cards, reused wherever a compact "here's what this item
// looks like" preview is needed (e.g. the profile card's pinned favorite).
export function CosmeticPreview({ item }: { item: CosmeticItem }) {
  if (item.type === "frame") {
    return (
      <CosmeticFrame frameId={item.id}>
        <div className="h-8 w-8 rounded-full bg-surface-2" />
      </CosmeticFrame>
    );
  }
  if (item.type === "banner") {
    return (
      <CosmeticBanner bannerId={item.id}>
        <div className="h-8 w-16 rounded-md bg-gradient-to-br from-surface-2 to-surface" />
      </CosmeticBanner>
    );
  }
  if (item.type === "badge") {
    return <CosmeticBadge badgeId={item.id} />;
  }
  return null;
}
