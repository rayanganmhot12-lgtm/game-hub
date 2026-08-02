// Renders behind (DOM-order, no z-index needed) a profile card that has the
// "banner-nebula" cosmetic equipped — the card itself keeps its own
// overflow-hidden for rounded corners, so this decoration lives as a
// sibling instead of fighting that clip.
export default function NebulaBackdrop() {
  return <div aria-hidden className="nebula-backdrop pointer-events-none absolute -inset-x-8 -top-16 h-40" />;
}
