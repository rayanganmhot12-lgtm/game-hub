const PLATFORM_META: Record<string, { label: string; className: string }> = {
  STEAM: { label: "Steam", className: "bg-platform-steam/15 text-platform-steam border-platform-steam/30" },
  EPIC: { label: "Epic", className: "bg-platform-epic/15 text-platform-epic border-platform-epic/30" },
  GOG: { label: "GOG", className: "bg-platform-gog/15 text-platform-gog border-platform-gog/30" },
};

export default function PlatformBadge({ platform }: { platform: string }) {
  const meta = PLATFORM_META[platform] ?? { label: platform, className: "bg-surface-2 text-muted border-border" };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
