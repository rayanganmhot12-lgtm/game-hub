# Theme Editor

## Why

The page has two problems, and the second one explains the first.

**It runs two systems that do the same thing.** There is a `Theme` — a
`data-theme` attribute, a storage key, a `:root[data-theme="dark-red"]` block in
`globals.css` — and separately a custom accent applied as inline variables on
`:root`. The `dark-red` block overrides exactly four properties: `--accent`,
`--accent-bright`, `--accent-dim`, `--accent-rgb`. That is precisely what the
custom accent sets. A "theme" here is a named colour and nothing more.

The clearest proof: `#ff6b00` and `#ff1f2d`, the accents of the two themes, are
already the first two entries in the page's own swatch row. Dark Red has been
selectable as a swatch the whole time.

**And the theme half is unreachable.** `setTheme` and `toggleTheme` are called
from nowhere in the app — not from this page, not from the navbar, not from
anywhere. `dark-red` is fully implemented in CSS and restored on boot, but no
interface can ever set it.

Which makes the anti-flash script wrong in both directions. The blocking script
in `layout.tsx` sets `data-theme` from storage so the right theme is in place
before hydration — guarding a value nothing can write — and does not apply the
custom accent at all. So the flash it prevents cannot happen, and the flash that
does happen, every launch for anyone with a custom accent, is unguarded.

Beyond that, the page is a form: two panels of rows, a native colour input and
two raw checkboxes — the last browser-default controls left after the sliders
were rebuilt — with a reset that covers the accent but not the background.

## What changes

### 1. One accent, not two systems

The `Theme` type, the `data-theme` attribute, the `dark-red` rule in
`globals.css`, `setTheme`, `toggleTheme`, and the theme half of the blocking
script all go.

Presets become one named list, each entry a hex, including the two that used to
be themes. Everything runs through `deriveAccentPalette` into the same four CSS
variables, applied inline, under a single storage key.

The blocking script applies the stored accent instead of the theme, which is
what ends the flash.

**No migration, and the reason is checkable:** `gamehub-theme` is only ever
written by `applyTheme`, which is only ever called by `setTheme`, which nothing
calls. The key cannot hold a value on any machine. Migration code for a value
that cannot exist is dead code, so there is none.

### 2. The page opens with what it edits

A preview panel first, composed of the primitives the accent actually appears
in and none of which are on this page today: a page title in its gradient, a
primary and a ghost button, a chip, an icon badge, a filled slider, and a panel
inside the panel so the top bloom and the lit seam are visible.

It is assembled from the existing classes — `.btn-primary`, `.btn-ghost`,
`.icon-badge`, `.section-title`, `.panel`, `.slider` — rather than styled
separately, so it cannot drift from what the rest of the app looks like.

### 3. Accent controls

Named preset tiles, each showing the derived trio rather than a single dot: the
accent, its bright and its dim are all applied, and one dot hides two thirds of
what you are choosing.

A custom colour is a swatch that opens the system picker, beside a hex field
that can be typed into and validated. Whichever is active is marked, preset or
custom alike.

### 4. Background controls, and a reset that covers the page

The intensity slider keeps its treatment. Grid and grain become a real switch
component — they are the last raw checkboxes in the theme editor, and the same
gap the sliders had before they were rebuilt.

Reset returns the accent *and* the background settings, not the accent alone.

## Out of scope

- Making a theme mean more than an accent — different surfaces, borders or
  backgrounds per theme. That was considered and rejected: it would touch every
  surface in the app, and nothing in the current design asks for it.
- The third raw checkbox in `ServerChips`. Unrelated to this page.
- Light mode. The app declares `color-scheme: dark` and is built around it.

## Verification

Typecheck, lint, and a production build.

**Not verifiable here:** how the page looks. `/theme-editor` sits behind the
app layout's auth, and the preview server has no signed-in session. Checkable
in the running app: that presets and a custom hex both apply live, that the
preview reflects them, that grid and grain toggle, that reset returns
everything, and — the flash fix — that reopening the app with a custom accent
no longer shows orange first.
