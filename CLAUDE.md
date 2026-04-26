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

**Refresh split**: `refreshUI()` runs every minute (level, entries, 7-day chart). `refreshAll()` runs on data changes only (adds summary + history chart). History chart never redraws on the timer.

## Dev
- `npm run dev` — Express on port 8080
- Primary: Mac Chrome + Safari. Secondary: Android Chrome.
- All buttons outside forms must have `type="button"`.
