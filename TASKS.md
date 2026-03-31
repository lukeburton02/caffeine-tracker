# Caffeine Tracker - Development Tasks

## Phase 1: Core Functionality (MVP) ✅
**Goal**: Basic working app with caffeine tracking and calculation

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
- [x] Tested on Mac Chrome (primary)
- [ ] Test on Android Chrome (secondary, when connectivity allows)
- [x] No console errors

---

## Phase 2: Enhanced UX ✅
**Goal**: Make it fast and delightful to use

### Task 2.1: Quick Entry Presets ✅
- [x] Preset buttons: Celsius (200mg), Huel (100mg), Neutonic (120mg), Tenzing Mango (160mg)
- [x] Clicking preset pre-fills form (amount + source) and focuses time field
- [x] Toast notification on log
- [x] Auto-cleanup of entries older than 7 days (with toast notification)

### Task 2.2: Entry History ✅
- [x] Entries displayed most-recent-first
- [x] Shows: source, time, original amount, current remaining mg
- [x] Delete with confirmation dialog

### Task 2.3: Visual Improvements ✅
- [x] Colour-coded level display and progress bar:
  - 0–100mg: Green (Low)
  - 100–200mg: Yellow (Moderate)
  - 200–400mg: Orange (High)
  - 400+mg: Red (Very High)
- [x] Smooth bar animation

---

## Phase 3: PWA Features ✅
**Goal**: Install to home screen and work offline

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
**Goal**: Help understand caffeine patterns

### Task 4.1: Daily Summary ✅
- [x] Total caffeine consumed today
- [x] Peak caffeine level (sampled every 15 mins, accounts for decay)
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

## Phase 5: V2 Redesign (branch: feature/v2-redesign) 🚧
**Goal**: Two-panel layout, retrospective entry, local file backup, full history chart

### Task 5.1: Date/Time Entry 🚧
- [ ] Replace time-only input with date + time inputs
- [ ] Hard block on future timestamps (currently only a warning — must become a hard rejection)
- [ ] Hard block on entries older than 7 days
- [ ] Update entry list to show date for non-today entries
- [ ] Update getEntryTimestamp() to use date+time combination

### Task 5.2: Entry Storage Architecture 🚧
**All entries are kept in localStorage forever — never auto-deleted — so charts always have full history.**
- [ ] Remove auto-cleanup (deletion from storage)
- [ ] "Recent entries" display: filter to entries where caffeine >= 1mg AND age <= 7 days (display filter only, not storage)
- [ ] Current caffeine level: sum all entries (fully decayed ones contribute ~0mg anyway)
- [ ] Charts (7-day bar, history time series): use ALL stored entries

### Task 5.3: Local File Backup 🚧
- [ ] File System Access API: user picks a folder once (stored in IndexedDB)
- [ ] Auto-saves caffeine_data.json to that folder on every data change
- [ ] Backup status shown in settings (linked/not linked + folder name)
- [ ] Add caffeine_data.json to .gitignore
- NOTE: No import from backup yet (future task). localStorage is source of truth.

### Task 5.4: Two-Panel Layout 🚧
- [ ] Left panel: level display, date/time input, presets, custom entry, recent entries, settings
- [ ] Right panel: today's summary, last 7 days bar chart, full history line chart
- [ ] Wider container (max ~1200px) to accommodate two panels
- [ ] Responsive: stack to single column on mobile (≤800px)

### Task 5.5: Full History Time Series Chart 🚧
- [ ] Line chart (canvas-based) showing daily total caffeine consumed per day
- [ ] X-axis: from first entry date to today
- [ ] Day labels: DD/MM format with weekday abbreviation below (e.g. "31/03" + "Tue")
- [ ] Month boundary: at first day of new month, show month name + year instead of date/weekday (e.g. "Mar" + "2026"), with vertical dashed line
- [ ] Y-axis: mg with gridlines
- [ ] Today's point highlighted
- [ ] Horizontally scrollable container if many days of data
- [ ] Filled dot markers on the line at each day

---

## Future Enhancements (Post-V2)
- [ ] Import data from backup file (reverse of Task 5.3)
- [ ] Review auto-refresh rate and battery/energy impact: current 1-min interval runs refreshUI() which redraws all canvases. History chart doesn't need to update every minute — only when data changes. Consider splitting the interval: current level + recent entries refresh every minute, charts only refresh on data change. Measure CPU impact.
- [ ] More exploratory analyses: *(think of ideas here — e.g. caffeine-free streaks, time-of-day patterns, weekday vs weekend averages, rolling average line on history chart)*
- [ ] Notifications when caffeine drops below a threshold
- [ ] Export data as CSV
- [ ] Dark mode
- [ ] Cloud sync — **IMPORTANT: Review LSHTM's data storage and cloud service policies before implementing any external sync (e.g. Firebase). LSHTM may restrict storing data with third-party services.**
- [ ] Native Android app conversion (very low priority)

---

## Notes
- Primary device: Mac (desktop browser, Chrome/Safari)
- Secondary device: Android phone (when network connectivity allows)
- Data is stored locally in browser localStorage — no accounts, no cloud
- Half-life default is 5 hours; individual variation is typically 3–7 hours
- LSHTM machine — review policies before any external data storage
