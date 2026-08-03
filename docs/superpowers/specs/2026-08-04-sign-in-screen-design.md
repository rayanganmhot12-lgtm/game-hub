# The sign-in screen

## Why

It is the first screen anyone sees, and the only one the recent design work
never reached. It still carries the shape of a marketing landing page for an
audience that, by definition, has already downloaded and installed the app.

Four specific faults, one of which cost a real hour today:

**The wordmark contradicts the app's own.** The navbar draws `GameHub` with the
whole word in the accent gradient. This screen draws `Game` in plain foreground
and only `Hub` in the gradient, at a hand-rolled `text-4xl font-extrabold`
rather than the `.page-title` treatment every page heading uses — so no halo
either. The largest type on the first screen is the one place the app's
identity is drawn a third way.

**There is no way to see the password you typed.** Sign in, get "Invalid email
or password", and nothing tells you whether the fault was your typing or the
account. That is not a hypothetical: it is exactly what happened while working
on this app, and it burned an hour before the cause was found elsewhere.

**`minLength={8}` applies in both modes.** Correct for registration. Wrong for
sign-in, where it refuses submission with a native browser tooltip instead of
the app's own message, and would lock out any shorter password that predates
the rule.

**The error is a bare red sentence** wedged between the fields and the button,
with no icon or frame — easy to miss entirely on a dark background.

Beyond the faults: three feature cards restate the sentence directly above
them, to people who already installed the thing.

## What changes

The screen becomes one thing — getting you in.

### Layout

A single centred card. The wordmark sits above it in the app's real treatment:
the whole word in the accent gradient with its halo, matching the navbar and
every page title. One line of subtitle. Then the form.

The three feature cards go.

### The form

- **A reveal toggle on the password field**, and a Caps Lock hint shown only
  while Caps Lock is actually on and the field has focus.
- **`minLength` on registration only.** Sign-in validates server-side and
  reports through the app's own error row.
- **Errors in a framed row with an icon**, above the button.
- **Labels above the fields** rather than placeholders alone, which vanish on
  first keystroke.
- **Correct `autoComplete`**: `email` and `current-password` when signing in,
  `new-password` when registering. This is what lets a password manager save
  and refill the credential, which is the real long-term fix for the failure
  that motivated this.
- Focus starts in the email field.

### Identity

The version and Beta chip from the navbar appear small beneath the card.
Knowing which build is in front of you is worth the two lines.

### Motion

The entrance stagger stays. The gamepad's endless rotation stops: a permanent
animation on a screen you sit still and type into is noise, not life.

## Out of scope

- Password reset or "forgot password" flow. Recovery today is a local script,
  and a UI for it is a separate piece of work with its own security questions.
- OAuth or Steam sign-in. Steam connects after sign-in, and moving it earlier
  changes the account model.
- A marketing page. Decided against: everyone reaching this screen has already
  installed the app.

## Verification

Unlike every other surface touched recently, this one sits outside the auth
gate — so it can actually be checked rather than reasoned about.

Typecheck, lint, and live in the browser: the reveal toggle, the Caps Lock
hint appearing and clearing, the framed error, switching between Sign In and
Sign Up, that `minLength` no longer blocks the sign-in submit, and a
screenshot of the finished screen.
