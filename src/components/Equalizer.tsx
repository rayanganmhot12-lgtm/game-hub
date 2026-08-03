// These tracks carry no cover art, so a moving level meter is what tells you
// something is playing — in the dock's art tile, and in place of the track
// number on whichever playlist row is current. One component so both stay in
// step with each other.
//
// The delays are deliberately not evenly spaced: four bars on an even cadence
// read as a wave sliding across, which looks mechanical. Uneven ones read as
// a meter responding to sound.
const BAR_DELAYS = ["0ms", "230ms", "90ms", "340ms"];

export default function Equalizer({
  className = "",
  barClassName = "w-[2px]",
}: {
  // Height lives on the wrapper — the bars fill it.
  className?: string;
  barClassName?: string;
}) {
  return (
    <span aria-hidden className={`flex items-end gap-[2px] ${className}`}>
      {BAR_DELAYS.map((delay) => (
        <span
          key={delay}
          style={{ animationDelay: delay }}
          className={`animate-equalizer-bar h-full rounded-full bg-current ${barClassName}`}
        />
      ))}
    </span>
  );
}
