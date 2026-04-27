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
- [x] `POST /api/save` — writes `data/caffeine_data.json` and `data/caffeine_data.csv` on every data change
- [x] `GET /api/load` — reads JSON back; imported on startup if localStorage is empty
- [x] On startup, existing localStorage data is saved immediately when server is first detected
- [x] Works in all browsers when running locally (Safari, Chrome, Firefox)
- [x] Settings row shows "Auto-saving to data/caffeine_data.json" when server is detected
- [x] File System Access API (Chrome/Edge) available as fallback on deployed version
- [x] Backup row hidden on Safari/Firefox when using deployed version
- [x] `data/caffeine_data.json` and `data/caffeine_data.csv` committed to repo (visible on GitHub)
- [x] CSV format: date, time (local), amount_mg, source — sorted chronologically

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

## Phase 6: Bug Fixes & Small Features ✅

### Task 6.1: Peak Calculation Fix ✅
- [x] Replaced 15-minute cursor sampling with exact timestamp checks
- [x] Peak is now checked at the exact moment each today entry is consumed — the only time a local maximum can occur
- [x] Example: 50mg at 9am + 120mg at 2pm now correctly gives ~145mg peak, not 170mg

### Task 6.3: Refresh Rate Optimisation ✅
- [x] 1-min tick reduced to `updateLevelDisplay()` + `renderEntries()` only
- [x] `updateSummary()`, `drawWeeklyChart()`, `drawHistoryChart()` moved to `refreshAll()` (data-change only)

### Task 6.4: High Caffeine Warning ✅
- [x] Red banner inside level display when caffeine crosses above 200mg
- [x] Visible for 10 seconds then auto-hides
- [x] Fires once per upward crossing — resets when level drops back below 200mg

### Task 6.5: CSV Download Button ✅
- [x] "Download CSV" button at bottom of right panel
- [x] Exports all entries as `caffeine_data_YYYY-MM-DD.csv` to Downloads folder
- [x] Works on deployed site and locally; same format as server-written CSV

### Task 6.2: History Chart Rendering ✅
- [x] Removed `border-radius` from scroll container (Safari compositing caused blurriness)
- [x] Canvas fills container width as minimum — renders at full resolution even with few data points
- [x] Use `ctx.setTransform` instead of `ctx.scale` for explicit state

---

## Phase 7: History Chart Enhancements & Editor ✅

### Task 7.1: Adaptive Tick Density ✅
- [x] Auto-compute tick interval based on total days (≤21 days: every day; ≤60: every 7; ≤180: every 14; else every 28)
- [x] Today always shown regardless of tick interval
- [x] Month boundary markers always shown

### Task 7.2: Windowed View Toggle ✅
- [x] Toggle between "all-time" (full range, scrollable) and "14-day window" modes
- [x] Left/right arrow buttons step the window backwards/forwards
- [x] Window defaults to most recent 14 days
- [x] Window mode fills container exactly (no scroll); all-time uses fixed 44px columns

### Task 7.3: Data History Editor ✅
- [x] Modal to browse and delete all stored entries (including hidden ones)
- [x] Entries grouped/sorted by date, delete with confirmation
- [x] Deletions propagate to localStorage, JSON, and CSV

### Task 7.4: Import from Backup ✅
- [x] File input to restore from `data/caffeine_data.json` manually
- [x] Works after moving browsers or clearing localStorage deliberately

---

## Phase 8: Exploratory Analysis Page

### Task 8.1: 2×2 Panel Layout ✅
- [x] Add 4 blank panel cards in a 2×2 grid on the analysis page
- [x] Each panel has a title in the top-left; forecast panel has model subtitle
- [x] Panels: "7-Day Forecast" (top-left), "Time of Day" (top-right), "Source Breakdown" (bottom-left), "Bedtime Caffeine" (bottom-right)
- [x] Responsive: stacks to 1 column on mobile (≤800px)
- [x] Dark mode styles included

### Task 8.2: Time-of-Day Intake Pattern (top-right) ✅
- [x] Weighted KDE: each entry contributes a Gaussian kernel scaled by its mg amount
- [x] Bandwidth via Silverman's rule (clamped 0.4–2.5 hrs), shown in subtitle
- [x] Wrap-around handling at midnight boundary
- [x] Filled area + outline curve; x-axis labels every 3 hours (12am–12am)
- [x] No y-axis labels — shape/relative density is what matters
- [x] Dark mode support

### Task 8.3: Source Breakdown Histogram (bottom-left) ✅
- [x] Bar chart: x-axis = source name (Neutonic, Celsius, etc.), y-axis = total mg consumed from that source
- [x] Log₁₀ scale on y-axis with mg labels (10, 100, 1000 etc.)
- [x] Bars sorted descending by total
- [x] Sources normalised to title case; "Unknown" grouped together
- [x] Source labels rotated -45°; value labels above each bar
- [x] Dark mode support via getChartColors()

### Task 8.4: Bedtime Caffeine Trend (bottom-right) ✅
- [x] Line chart over all history: estimated mg remaining at 23:00 each day (using half-life decay across all prior entries)
- [x] Subtitle: "Estimated mg remaining at 11:00 pm"
- [x] Y-axis gridlines at 0, mid, max; x-axis adaptive tick density + month boundaries
- [x] Scrollable horizontally for long histories; dots + connecting line; today highlighted
- [x] Dark mode support; distinct purple (#764ba2) to differentiate from other charts

### Task 8.5: 7-Day Forecast with Uncertainty (top-left) ✅
- [x] Upgraded to triple exponential smoothing (Holt-Winters additive, m=7 weekly seasonality)
- [x] Falls back to double exp smoothing when <14 days of history
- [x] 80% prediction interval: ±1.28 × RMSE × √h, widening with horizon h
- [x] Shaded band + dashed upper/lower bounds; solid forecast line from today anchor
- [x] Last 14 completed days shown as greyed context line; today highlighted
- [x] Dashed vertical separator between history and forecast zone
- [x] Adaptive x-axis labels; "forecast →" label in forecast zone
- [x] Info button (ⓘ) top-right: click toggles overlay with model description + equations
- [x] Dark mode support

---

## Phase 9: Live Episode Page ✅

### Task 9.1: Live Caffeine Chart ✅
- [x] Third page (Main → Analysis → Live), navigated via arrow buttons
- [x] Dynamic window: looks back to last <5mg crossing (capped 48h); projects forward to clearance
- [x] If no active episode: shows last complete episode within 48h lookback
- [x] Past portion: solid purple line; future projected decay: dashed + faded
- [x] Animated pulsing "now" dot via requestAnimationFrame interpolation between 5-min samples
- [x] "Now" vertical dashed line + x-axis label
- [x] 5mg threshold shown as red dashed horizontal line
- [x] Header subtitle: "Episode started Xh Ym ago · clears in ~Xh Ym"
- [x] rAF loop only runs when episode page is active; auto-pauses when tab hidden
- [x] Curve rebuilds every minute (via refreshUI) and on every data change (via refreshAll)
- [x] Dark mode support

---

## Phase 10: UX Polish & Visual Tidiness

### Task 10.1: Settings Modal ✅
- [ ] Move dark mode toggle, half-life, backup/import into a gear-icon modal
- [ ] Gear button fixed in a corner (or top of right panel)
- [ ] Remove settings section from main panel entirely
- [ ] Move export buttons (CSV/JSON) into the modal too

### Task 10.2: Collapse Date & Time into Quick Add row
- [ ] Date & time inputs sit inline above preset buttons, not as a separate titled section
- [ ] Reduces vertical scroll on left panel

### Task 10.3: Tab bar navigation
- [ ] Replace fixed corner arrow buttons with a persistent top tab bar (Main · Analysis · Live)
- [ ] Makes 3-page structure immediately obvious to the user

### Task 10.4: Unified panel style
- [ ] Main page panels and analysis panels use consistent border-radius, background, and shadow

---

## Future Enhancements
- [ ] Caffeine-free streaks panel (potential future addition)
- [x] **Dark mode** — toggle switch added
- [ ] Cloud sync — **IMPORTANT: review LSHTM's policies on third-party cloud services before implementing**
- [ ] Native Android app (very low priority)

---

## Notes
- Primary device: Mac (Safari and Chrome)
- Secondary device: Android phone (when network connectivity allows)
- LSHTM machine — review policies before any external data storage
- Half-life default is 5 hours; individual variation is typically 3–7 hours
