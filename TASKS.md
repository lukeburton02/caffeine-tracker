# Caffeine Tracker - Development Tasks

## Phase 1: Core Functionality (MVP)
**Goal**: Basic working app with caffeine tracking and calculation

### Task 1.1: Project Setup ✅
- [x] Create project directory structure
- [x] Initialize npm project
- [x] Create CLAUDE.md and TASKS.md

### Task 1.2: Basic HTML Structure
- [ ] Create `src/index.html` with:
  - Proper PWA meta tags (viewport, theme-color, manifest link)
  - Basic semantic HTML structure
  - Form for logging caffeine (amount input, time picker, source/description)
  - Display area for current caffeine level
  - List of recent entries
- [ ] Create `src/manifest.json` with PWA configuration

### Task 1.3: Core JavaScript Logic
- [ ] Create `src/app.js` with:
  - Function to calculate current caffeine from one entry: `calculateCurrentCaffeine(entry)`
  - Function to calculate total current caffeine from all entries: `getTotalCurrentCaffeine()`
  - LocalStorage functions: `saveEntry()`, `getEntries()`, `deleteEntry()`
  - Event handlers for the form submission
  - Function to update the UI with current caffeine level
  - Auto-refresh current level every minute

### Task 1.4: Basic Styling
- [ ] Create `src/styles.css` with:
  - Mobile-first responsive design
  - Large, touch-friendly buttons (min 44px)
  - Clear typography (min 16px base font size)
  - High contrast colors
  - Prominent display of current caffeine level

### Task 1.5: Testing & Validation
- [ ] Test caffeine calculation accuracy:
  - Entry: 100mg at 12:00pm → At 5:00pm should show ~50mg
  - Entry: 100mg at 12:00pm → At 10:00pm should show ~25mg
- [ ] Test data persistence (close browser, reopen, data still there)
- [ ] Test on Mac Chrome/Safari (primary)
- [ ] Test on Android Chrome browser (secondary, when connectivity allows)
- [ ] Verify no console errors

## Phase 2: Enhanced UX
**Goal**: Make it fast and delightful to use

### Task 2.1: Quick Entry Presets
- [ ] Add quick-entry buttons for common drinks:
  - "Espresso (63mg)"
  - "Coffee - Small (95mg)"
  - "Coffee - Medium (140mg)"
  - "Energy Drink (80mg)"
- [ ] Clicking preset auto-fills amount and logs immediately
- [ ] Show visual feedback on entry (toast notification or animation)

### Task 2.2: Entry History
- [ ] Display list of recent entries (last 24 hours)
- [ ] Show: time, amount, source, and current contribution to total
- [ ] Add delete button for each entry (with confirmation)
- [ ] Sort by time (most recent first)

### Task 2.3: Visual Improvements
- [ ] Add caffeine level visualization (progress bar or gauge)
- [ ] Color-code current level:
  - 0-100mg: Green (low)
  - 100-200mg: Yellow (moderate)
  - 200-400mg: Orange (high)
  - 400+mg: Red (very high)
- [ ] Add smooth animations for updates

## Phase 3: PWA Features
**Goal**: Install to home screen and work offline

### Task 3.1: Service Worker
- [ ] Create `src/service-worker.js`
- [ ] Implement caching strategy for offline support
- [ ] Register service worker in app.js
- [ ] Test offline functionality

### Task 3.2: Installability
- [ ] Verify manifest.json is complete with icons
- [ ] Create app icons (can use simple generated icons initially)
- [ ] Test "Add to Home Screen" on Android
- [ ] Verify app launches in standalone mode

### Task 3.3: Polish
- [ ] Add loading states
- [ ] Add error handling for localStorage
- [ ] Handle edge cases (negative times, very large amounts)

## Phase 4: Analytics & Insights (Optional)
**Goal**: Help understand caffeine patterns

### Task 4.1: Daily Summary
- [ ] Show total caffeine consumed today
- [ ] Show peak caffeine level for the day
- [ ] Show time when caffeine was highest

### Task 4.2: Historical View
- [ ] Weekly caffeine consumption chart
- [ ] Average daily intake

## Future Enhancements (Post-MVP)
- [ ] Cloud sync with Firebase (for Mac access) — **IMPORTANT: Review LSHTM's data storage and cloud service policies before implementing any external sync/cloud storage. LSHTM may have restrictions on storing data with third-party services like Firebase.**
- [ ] Notifications when caffeine drops below threshold
- [ ] Custom half-life setting (varies by individual)
- [ ] Export data as CSV
- [ ] Dark mode
- [ ] Native Android app conversion (very low priority)

---

## Current Focus
**START HERE**: Phase 1, Task 1.2 - Create the basic HTML structure

## Notes
- Complete Phase 1 before moving to Phase 2
- Test thoroughly on Android device before considering a task complete
- Keep it simple - resist feature creep until core works perfectly
