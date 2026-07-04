# Caffeine Tracker PWA

Vanilla JS PWA using native ES modules (no bundler). Deployed to GitHub Pages at https://lukeburton02.github.io/caffeine-tracker/ — this is the primary version. Local dev via Express (`npm run dev`, port 8080). Hard refresh with `Cmd+Shift+R` after changes to bypass service worker cache.

**LSHTM machine** — review policies before adding any cloud sync or external storage.

## Module structure

```
src/
├── index.html            # PWA shell — <script type="module" src="app.js">
├── app.js                # Event wiring, navigation, init, refreshUI/refreshAll
├── calculations.js       # Pure math: getHalfLife, calculateCurrentCaffeine, computeLevelAt, getCaffeineAtTime
├── storage.js            # localStorage, Express server API, File System Access API, export, preview mode
├── toast.js              # showToast (shared by storage and ui)
├── charts-shared.js      # isDarkMode(), getChartColors() — imported by all chart files
├── charts-main.js        # drawWeeklyChart, drawHistoryChart, history state (historyMode/offset)
├── charts-analysis.js    # drawForecast, drawSourceBreakdown, drawTimeOfDay, drawBedtimeCaffeine, drawHeatmap
├── charts-episode.js     # buildEpisodeCurve, rAF animation loop, episode subtitle
├── ui.js                 # DOM updates: level display, entries, summary, history editor
├── styles.css            # Layout, components, charts, dark mode base
├── styles-modals.css     # Modals, settings, gear button, preview bar, all dark mode overrides
├── service-worker.js
└── manifest.json
```

`window.handleDelete` is explicitly exposed in `app.js` for the inline `onclick` in entry list HTML.

## Non-obvious rules

**Data retention**: all entries stored in localStorage forever, never deleted. Display is filtered; storage is not.
- Recent Entries list: only entries with ≥1mg remaining AND age ≤7 days
- Charts and current level: use full unfiltered entry list

**Entry validation**: future timestamps hard-blocked; entries older than 14 days rejected (both with toast).

**Peak calculation**: checked at the exact timestamp of each today entry only — the only moment a local max can occur (caffeine only decays after that point).

**Preview mode**: `sessionStorage`-based overlay. `getEntries()` is the single interception point — returns demo data when preview is active. All write functions are no-ops in preview mode. Activated via Settings modal or the demo banner (shown when no real entries exist).

**Data persistence** (tried in order):
1. Express server (`/api/save`, `/api/load`) — local dev only
2. File System Access API — Chrome/Edge on GitHub Pages only
3. localStorage — all browsers on GitHub Pages (primary storage)

**Refresh split**: `refreshUI()` runs every minute (level, entries, episode curve). `refreshAll()` runs on data changes only (all charts + summary). History chart never redraws on the timer.

**Episode page (page 3)**: `buildEpisodeCurve()` runs only when episode page is active. Peak labels (source name at each entry's timestamp) computed at build time and stored in `episodeCurve.peakLabels` — not recomputed per frame. `requestAnimationFrame` loop auto-pauses when tab is hidden.

**History chart state**: `historyMode` and `historyWindowOffset` live in `charts-main.js` — access via exported getters/setters.

**Page navigation**: 3 pages (main → analysis → live). `navigateTo(n)` in `app.js` handles the CSS transform class, tab bar active state, and starting/stopping the rAF loop via `startEpisodeAnimation()` / `stopEpisodeAnimation()`.

**CSS split**: `styles.css` has layout + components. `styles-modals.css` has modals, gear button, preview bar, and ALL dark mode overrides. When adding new dark mode rules, put them in `styles-modals.css`.

## Dev
- `npm run dev` — Express on port 8080
- Mac Chrome + Safari. Mobile breakpoint at 900px.
- All buttons outside forms must have `type="button"`.

## Maintenance
**GitHub Actions version bumps**: GitHub drops old Node.js versions from runners every 1–2 years; the Pages actions cut a new major version to match. When deprecation warnings appear in Actions logs:
1. Check latest releases: `gh api repos/actions/checkout/releases/latest --jq '.tag_name'` (repeat for configure-pages, upload-pages-artifact, deploy-pages)
2. Review release notes for breaking changes (historically just Node.js bumps — safe to update)
3. Bump all four in `.github/workflows/deploy.yml` together
