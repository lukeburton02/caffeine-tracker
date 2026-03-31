# Caffeine Tracker - Development Tasks

## Phase 1: Core Functionality (MVP) ✅

### Task 1.1: Project Setup ✅
- [x] Create project directory structure
- [x] Initialize npm project
- [x] Create CLAUDE.md and TASKS.md

### Task 1.2: Basic HTML Structure ✅
- [x] Create `src/index.html` with PWA meta tags, semantic structure, log form, level display, entry list
- [x] Create `src/manifest.json` with PWA configuration

### Task 1.3: Core JavaScript Logic ✅
- [x] `calculateCurrentCaffeine(entry)` using half-life decay
- [x] `getTotalCurrentCaffeine()` summing all entries
- [x] LocalStorage functions: `saveEntry()`, `getEntries()`, `deleteEntry()`
- [x] Form submission handler
- [x] UI update functions
- [x] Auto-refresh every minute

### Task 1.4: Basic Styling ✅
- [x] Desktop-first responsive design
- [x] Large touch-friendly buttons (min 44px)
- [x] Clear typography
- [x] Prominent caffeine level display

### Task 1.5: Testing & Validation ✅
- [x] Caffeine calculation accuracy verified
- [x] Data persistence confirmed
- [x] Tested on Mac Chrome and Safari (primary)
- [ ] Test on Android Chrome (when connectivity allows)
- [x] No console errors

---

## Phase 2: Enhanced UX ✅

### Task 2.1: Quick Entry Presets ✅
- [x] Preset buttons: Celsius (200mg), Huel (100mg), Neutonic (120mg), Tenzing Mango (160mg)
- [x] Clicking a preset immediately logs using current date/time input values
- [x] Toast notification on log

### Task 2.2: Entry History ✅
- [x] Entries displayed most-recent-first
- [x] Shows: source, date/time, original amount, current remaining mg
- [x] Non-today entries show date alongside time
- [x] Delete with confirmation dialog

### Task 2.3: Visual Improvements ✅
- [x] Colour-coded level display and progress bar (Low/Moderate/High/Very High)
- [x] Smooth bar animation

---

## Phase 3: PWA Features ✅

### Task 3.1: Service Worker ✅
- [x] `src/service-worker.js` with network-first strategy (offline fallback)
- [x] Registered in app.js

### Task 3.2: Installability ✅
- [x] `manifest.json` complete with SVG icon
- [ ] Test "Add to Home Screen" on Android (pending connectivity)

### Task 3.3: Polish ✅
- [x] localStorage error handling (try/catch)
- [x] Input validation (negative, NaN, >2000mg)
- [x] Empty source defaults to "Unknown"

---

## Phase 4: Analytics & Insights ✅

### Task 4.1: Daily Summary ✅
- [x] Total caffeine consumed today
- [x] Peak caffeine level — checked at exact timestamp of each today entry (not sampled; see Phase 6 fix)
- [x] Time of peak

### Task 4.2: Historical View ✅
- [x] 7-day bar chart (canvas-based, no libraries)
- [x] Today highlighted in purple

---

## Custom Half-Life Setting ✅
- [x] Configurable half-life (default 5 hours, range 1–24)
- [x] Persisted in localStorage
- [x] Saving immediately recalculates all displayed caffeine levels
- [x] Reset button to restore default

---

## Phase 5: V2 Redesign ✅

### Task 5.1: Date/Time Entry ✅
- [x] Replaced time-only input with date + time inputs
- [x] Future timestamps hard-blocked (rejected with toast)
- [x] Entries older than 7 days rejected with toast
- [x] Entry list shows date for non-today entries
- [x] `getEntryTimestamp()` uses date + time combination

### Task 5.2: Entry Storage Architecture ✅
- [x] All entries kept in localStorage forever — never deleted
- [x] Recent Entries display filtered to: caffeine >= 1mg AND age <= 7 days (display filter only)
- [x] Current level sums all entries (fully decayed ones contribute negligibly)
- [x] All charts use the full unfiltered entry list

### Task 5.3: Local Data Persistence ✅
- [x] Express server (`server.js`) replaces `npx http-server`
- [x] `POST /api/save` — writes `data/caffeine_data.json` to disk on every data change
- [x] `GET /api/load` — reads it back; imported on startup if localStorage is empty
- [x] Works in all browsers when running locally (Safari, Chrome, Firefox)
- [x] Settings row shows "Auto-saving to data/caffeine_data.json" when server is detected
- [x] File System Access API (Chrome/Edge) available as fallback on deployed version
- [x] Backup row hidden on Safari/Firefox when using deployed version
- [x] `data/` and `caffeine_data.json` added to .gitignore

### Task 5.4: Two-Panel Layout ✅
- [x] Left panel: level display, date/time input, presets, custom entry, recent entries, settings
- [x] Right panel: today's summary, 7-day chart, full history chart
- [x] Max width ~1200px; stacks to single column on mobile (≤800px)

### Task 5.5: Full History Line Chart ✅
- [x] Canvas line chart — daily total consumed, from first entry date to today
- [x] DD/MM date labels + weekday abbreviation below each column
- [x] Month boundaries: month name + year labels with vertical dashed line
- [x] Y-axis gridlines (0, half-max, max)
- [x] Today highlighted; filled dot markers with white centres
- [x] Horizontally scrollable; canvas fills container width as minimum (crisp on all DPR)
- [x] History chart only redraws on data change, not on the 1-minute tick

---

## Phase 6: Bug Fixes ✅

### Task 6.1: Peak Calculation Fix ✅
- [x] Replaced 15-minute cursor sampling with exact timestamp checks
- [x] Peak is now checked at the exact moment each today entry is consumed — the only time a local maximum can occur
- [x] Example: 50mg at 9am + 120mg at 2pm now correctly gives ~145mg peak, not 170mg

### Task 6.2: History Chart Rendering ✅
- [x] Removed `border-radius` from scroll container (Safari compositing caused blurriness)
- [x] Canvas fills container width as minimum — renders at full resolution even with few data points
- [x] Use `ctx.setTransform` instead of `ctx.scale` for explicit state

---

## Future Enhancements
- [ ] **Refresh rate audit**: the 1-minute tick redraws the weekly chart and current level on every tick. Measure actual CPU/battery cost; consider whether weekly chart needs to refresh every minute or only on data change (like the history chart already does)
- [ ] **Import from backup**: restore from `data/caffeine_data.json` manually (e.g. after moving browsers or clearing localStorage deliberately)
- [ ] **Exploratory analyses**: ideas to consider — caffeine-free streaks, time-of-day intake patterns, weekday vs weekend averages, rolling average overlay on history chart, sleep impact estimate
- [ ] Notifications when caffeine drops below a threshold
- [ ] Export data as CSV
- [ ] Dark mode
- [ ] Cloud sync — **IMPORTANT: review LSHTM's policies on third-party cloud services before implementing**
- [ ] Native Android app (very low priority)

---

## Notes
- Primary device: Mac (Safari and Chrome)
- Secondary device: Android phone (when network connectivity allows)
- LSHTM machine — review policies before any external data storage
- Half-life default is 5 hours; individual variation is typically 3–7 hours
