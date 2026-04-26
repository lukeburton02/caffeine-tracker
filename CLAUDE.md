# Caffeine Tracker PWA

Vanilla JS PWA. Deployed to GitHub Pages at https://lukeburton02.github.io/caffeine-tracker/ — this is the primary version. Local dev via Express (`npm run dev`, port 8080) still works but is no longer the primary. Hard refresh with `Cmd+Shift+R` after changes to bypass service worker cache.

**LSHTM machine** — review policies before adding any cloud sync or external storage.

## Non-obvious rules

**Data retention**: all entries stored in localStorage forever, never deleted. Display is filtered; storage is not.
- Recent Entries list: only entries with ≥1mg remaining AND age ≤7 days
- Charts and current level: use full unfiltered entry list

**Entry validation**: future timestamps hard-blocked; entries older than 7 days rejected (both with toast).

**Peak calculation**: checked at the exact timestamp of each today entry only — the only moment a local max can occur (caffeine only decays after that point).

**Data persistence** (tried in order):
1. Express server (`/api/save`, `/api/load`) — local dev only
2. File System Access API — Chrome/Edge on GitHub Pages only
3. localStorage — all browsers on GitHub Pages (primary storage)

**Refresh split**: `refreshUI()` runs every minute (level, entries). `refreshAll()` runs on data changes only (all charts + summary). History chart never redraws on the timer.

**Episode page (page 3)**: `buildEpisodeCurve()` runs only when episode page is active (guarded by `episodeAnimFrame`). `requestAnimationFrame` loop auto-pauses when tab is hidden. Curve recomputes every minute via `refreshUI()` and on every data change via `refreshAll()`.

**Page navigation**: 3 pages (main → analysis → live). `navigateTo(n)` handles track transform class, nav button labels, and starting/stopping the rAF loop.

## Dev
- `npm run dev` — Express on port 8080
- Primary: Mac Chrome + Safari. Secondary: Android Chrome.
- All buttons outside forms must have `type="button"`.
