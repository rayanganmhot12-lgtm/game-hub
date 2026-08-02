// Fixed (not random) star positions — randomizing at render time would
// mismatch between the server and client render and break hydration.
const STARS = [
  { left: "8%", top: "20%", size: 3, opacity: 0.9 },
  { left: "20%", top: "55%", size: 2, opacity: 0.6 },
  { left: "32%", top: "12%", size: 2, opacity: 0.8 },
  { left: "14%", top: "78%", size: 2, opacity: 0.9 },
  { left: "40%", top: "68%", size: 3, opacity: 0.5 },
  { left: "4%", top: "45%", size: 2, opacity: 0.7 },
  { left: "48%", top: "30%", size: 2, opacity: 0.6 },
];

// A small ringed planet + moon + a handful of stars, drawn as real shapes
// instead of blurry gradient washes — keeps the underlying banner photo
// mostly visible instead of getting painted over.
export default function NebulaScene({ className = "" }: { className?: string }) {
  return (
    <div className={`nebula-scene pointer-events-none absolute inset-0 ${className}`}>
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 65% 70% at 62% 60%, rgba(244, 114, 182, 0.28), transparent 72%)" }}
      />
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, opacity: s.opacity }}
        />
      ))}
      <div
        className="absolute rounded-full border border-white/40"
        style={{ left: "60%", top: "58%", width: 76, height: 26, transform: "translate(-50%, -50%) rotate(-14deg)" }}
      />
      <div
        className="absolute rounded-full"
        style={{
          left: "60%",
          top: "58%",
          width: 42,
          height: 42,
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle at 32% 28%, #fce7f3, #f472b6 55%, #9d174d 88%)",
          boxShadow: "0 0 16px 2px rgba(244, 114, 182, 0.5)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          left: "84%",
          top: "26%",
          width: 15,
          height: 15,
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle at 32% 28%, #fce7f3, #f472b6 70%)",
        }}
      />
    </div>
  );
}
