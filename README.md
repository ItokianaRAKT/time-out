# TimeOut

A Chrome extension (Manifest V3) that pulls you back on track: on blacklisted sites, **dark digital grime creeps across the entire screen**, **suspends all interactions**, then demands a **focus challenge** dead-center to unlock.

## How it works

### Trigger

- After the configured number of **seconds** (popup setting, **minimum 2 minutes**, default 120 s).
- Sites matched: the popup's **blocked sites list** (exact host match — `notyoutube.com` is not `youtube.com`).
- (A hidden `testMode` flag in `storage.local` shortens the grace period to 5 s; only the E2E suites set it.)

### The effect

1. A dark, dusty texture **crawls from the edges to the center** over **12 seconds** (animated noise grain), while its **opacity increases one step per second** until the screen is fully grimed.
2. **Total blackout**: opaque matte-black background, then the challenge appears **perfectly centered** (measured offset: 0 px).
3. **All interactions suspended**: `body.inert`, scrolling frozen (`overflow: hidden !important`), event listeners captured and swallowed — the page receives **zero clicks, zero keystrokes, zero wheel events**, and even hostile site CSS cannot reach the challenge thanks to **Shadow DOM isolation**.
4. A **"Hide browser bars (fullscreen)"** button also covers Chrome's own UI (an extension cannot paint the tab bar or address bar otherwise).

### The challenge

- **Time out — always required**: a countdown of `blockSeconds` during which the screen stays locked.
- **Retype a phrase — optional** (checkbox in the popup, on by default): shown **first**. Once the phrase is retyped correctly, the input disappears and the classic countdown takes its place — and **only then does the countdown start** (without the option, the countdown starts at seal). The screen unlocks when the countdown elapses.

### Block persistence

Once a screen seals, the domain is marked **"struck"** in `chrome.storage.local`. After that:

- **Tab reload** (F5) ⇒ re-sealed **near-instantly**;
- **New tab or window of the same domain** ⇒ same;
- **Extension reload or update** ⇒ same (strikes live in `storage.local`, not `storage.session` which Chrome clears on every reload);
- **Browser restart** ⇒ same (a "new session" stays blocked).

A strike is removed only in three cases: the **"Reset all blocks"** button in the popup, removing the site from the blocked list, or uninstalling the extension.

> **Known limit**: browser shortcuts (F5, Ctrl+W) cannot be intercepted by an extension — but their effect is neutralized because the page re-seals immediately.

## Installation

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. After any code change: **Reload** (and reopen the tab — content scripts are not reinjected into already-open tabs).

## Settings (popup)

| Setting | Role |
|---|---|
| Time before grime | Delay in seconds, min 120 (max 7200 = 2h) |
| Time out duration | Locked countdown in seconds (min 10, max 3600) |
| Retype a phrase | Optional extra challenge (checkbox) |
| Blocked sites | Blacklist (add/remove) |
| Active blocks | Struck domains + reset button |
| Save | Applies and re-schedules open tabs |

## Theme & Icons

- **Theme**: matte black & glossy black, off-white text (effect & popup).
- **Icon**: [Papicons](https://github.com/PapillonApp/papicons) — open-source icon set:
  - **Popup logo**: imported **by URL**, no file downloaded in the popup:
    `https://raw.githubusercontent.com/PapillonApp/Papicons/master/icons/sparkles.svg`.
  - **Toolbar / extension**: local PNGs (`icons/icon16/48/128.png`, declared in `manifest.json`) generated from the same Papicons trace (`icons/icon.svg`) — full-bleed square, no white border and no rounded corners, as Chrome requires.

## Development

Files:

- `manifest.json` — MV3, permissions `storage` + `tabs`.
- `background.js` — per-tab scheduling, blacklist, strikes.
- `styles.js` — effect CSS (applied inside Shadow DOM via `adoptedStyleSheets`, immune to site CSP).
- `content.js` — overlay, sealing, challenge.
- `popup.html` / `popup.js` — settings UI.

Tests: full E2E via Chrome headless + CDP (extension load, 5 s grace via `testMode`, 12 s grime ramp with per-second opacity steps, viewport coverage, centering, interaction freeze, time out mandatory + optional phrase, persistence after reload/new tab/new session, popup settings incl. the 120 s minimum).