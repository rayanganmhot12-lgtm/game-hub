import NebulaScene from "@/components/NebulaScene";

// Renders behind (DOM-order, no z-index needed) a profile card that has the
// "banner-nebula" cosmetic equipped — the card itself keeps its own
// overflow-hidden for rounded corners, so this decoration lives as a
// sibling instead of fighting that clip. Deliberately no overflow-hidden
// here, unlike the in-banner NebulaScene, so the blur can soften its edges.
export default function NebulaBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-x-8 -top-16 h-40">
      <NebulaScene className="opacity-90 blur-[1.5px]" />
    </div>
  );
}
