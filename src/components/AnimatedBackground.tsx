// Pure decorative background — no interactivity, so this stays a Server
// Component. Every color derives from --accent-rgb (see globals.css), so it
// automatically re-themes between Neon Orange and Dark Red with no JS.
export default function AnimatedBackground() {
  return (
    <div aria-hidden className="bg-aurora">
      <div className="bg-aurora__grid" />
      <div className="bg-aurora__blob bg-aurora__blob--1" />
      <div className="bg-aurora__blob bg-aurora__blob--2" />
      <div className="bg-aurora__blob bg-aurora__blob--3" />
      <div className="bg-aurora__grain" />
      <div className="bg-aurora__vignette" />
    </div>
  );
}
