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
- [x] Auto-cleanup of entries with <1mg remaining (with toast notification)

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
- [x] Input validation (negative, NaN, >2000mg, future time warning)
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

## Future Enhancements (Post-MVP)
- [ ] Notifications when caffeine drops below a threshold
- [ ] Export data as CSV
- [ ] Dark mode
- [ ] Cloud sync — **IMPORTANT: Review LSHTM's data storage and cloud service policies before implementing any external sync (e.g. Firebase). LSHTM may restrict storing data with third-party services.**
- [ ] Native Android app conversion (very low priority)

---

## Notes
- Primary device: Mac (desktop browser)
- Secondary device: Android phone (when network connectivity allows)
- Data is stored locally in browser localStorage — no accounts, no cloud
- Half-life default is 5 hours; individual variation is typically 3–7 hours
