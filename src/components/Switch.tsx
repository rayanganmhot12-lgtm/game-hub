"use client";

// A raw checkbox tinted with accent-color was the last piece of browser chrome
// on the theme editor, the same gap the range inputs had before they were
// rebuilt. A button rather than a styled input: there is no label association
// to preserve here — the caller supplies the label and owns the click target.
export default function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-sm"
    >
      <span className="text-foreground">{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked
            ? "bg-gradient-to-r from-accent to-accent-bright shadow-[0_0_14px_-4px_rgba(var(--accent-rgb),0.9)]"
            : "bg-surface-2 ring-1 ring-inset ring-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground shadow transition-transform duration-200 ${
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
