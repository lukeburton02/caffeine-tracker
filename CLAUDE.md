# Caffeine Tracker PWA

## Project Overview
A Progressive Web App for tracking caffeine intake and calculating current caffeine levels using biological half-life decay. Runs locally via a small Express server (`server.js`) that also handles on-disk data persistence. Deployed to GitHub Pages as a static fallback (data saved to localStorage only on the deployed version).

## Tech Stack
- **Vanilla JavaScript** (ES6+, no frameworks)
- **HTML5 / CSS3**
- **localStorage** — primary runtime data store; all entries kept forever, never auto-deleted
- **Express (server.js)** — local dev server; adds `/api/save` and `/api/load` for on-disk persistence
- **IndexedDB** — stores the File System Access API folder handle for Chrome on the deployed version
- **Canvas API** — 7-day bar chart and full history line chart (no libraries)
- **Service Worker** — PWA offline support (network-first strategy)

## Project Structure
```
caffeine-tracker/
├── src/
│   ├── index.html         # App structure (two-panel layout)
│   ├── app.js             # All logic: calculations, storage, UI, analytics, backup
│   ├── styles.css         # Styling
│   ├── service-worker.js  # PWA offline (network-first, falls back to cache)
│   ├── manifest.json      # PWA config with SVG icon
│   └── icon.svg           # App icon
├── server.js              # Express local dev server with /api/save and /api/load
├── package.json
├── CLAUDE.md              # This file
├── TASKS.md               # Full development history and roadmap
├── QUICKSTART.md          # How to run the app
└── README.md              # Project overview
```

## Key Requirements

### Caffeine Calculation
- **Half-life**: Configurable (default 5 hours), stored in localStorage under `caffeine_halflife`
- **Formula**: `current_amount = initial_amount * (0.5 ^ (hours_elapsed / half_life))`
- **Precision**: 1 decimal place (e.g. "45.3 mg")
- Changing half-life immediately recalculates all displayed values — no entry migration needed

### Data Structure
localStorage key: `caffeine_entries`
```javascript
[
  {
    id: "timestamp_string",
    timestamp: "2026-03-30T14:30:00.000Z",
    amount: 200,       // mg of caffeine
    source: "Celsius"  // drink name
  }
]
```

localStorage key: `caffeine_halflife` — single float, hours

**All entries are stored forever and never deleted.** This ensures charts always have full historical data.

### Entry Display Rules (not storage rules)
- **Recent Entries list**: shows only entries where remaining caffeine >= 1mg AND age <= 7 days
- **Current level**: sums all entries (fully decayed ones contribute negligibly)
- **All charts**: use the full unfiltered entry list

### Entry Timestamp Rules
- **Entry date/time**: two separate inputs — `input[type="date"]` and `input[type="time"]`
- **Future timestamps**: hard block — rejected with toast
- **Maximum retrospective**: entries older than 7 days are rejected with toast
- Preset buttons log immediately using current date + time input values; same validation applies

### Preset Drinks
- Celsius: 200mg
- Huel: 100mg
- Neutonic: 120mg
- Tenzing Mango: 160mg

Clicking a preset immediately logs an entry using the current date/time input values. No form fill + submit step.

### Peak Calculation
Peak caffeine level for the day is calculated by checking the total level at the **exact timestamp of each today entry** — this is the only moment a local maximum can occur (caffeine only decays after consumption). Earlier 15-minute sampling was replaced with this exact approach.

### Data Persistence
Three layers, tried in order:

1. **Express server** (`npm run dev` locally, any browser): `saveToServer()` POSTs to `/api/save` on every data change → written to `data/caffeine_data.json`. On startup, `loadFromServer()` imports from this file if localStorage is empty.
2. **File System Access API** (Chrome/Edge on the deployed version only): user links a folder once; `caffeine_data.json` saved there on every change.
3. **localStorage only** (Safari/Firefox on the deployed version): no disk backup available.

The backup row in Settings reflects which method is active:
- Local server running → "Auto-saving to data/caffeine_data.json" (button hidden)
- Chrome on deployed version → "Link folder" button
- Safari/Firefox on deployed version → backup row hidden entirely

`data/` is gitignored. `caffeine_data.json` (File System API output) is gitignored.

### Layout
Two-panel layout on desktop (>800px), stacked on mobile:

**Left panel:**
- Current caffeine level (number + colour bar + status + last updated)
- Date + time inputs (shared by presets and custom entry)
- Quick Add presets
- Custom entry form
- Recent Entries list
- Settings (half-life, backup)

**Right panel:**
- Today's Summary (total consumed, peak level, peak time)
- Last 7 Days bar chart
- Full History line chart (horizontally scrollable)

### History Line Chart
- Daily total caffeine consumed, from first-ever entry date to today
- Canvas-based, no libraries; container is `overflow-x: auto` (scrolls when many days)
- Canvas fills container width as minimum (ensures crisp rendering even with few data points)
- X-axis: DD/MM date label + weekday abbreviation below each day column (44px wide)
- Month boundaries: first day of a new month shows month name ("Mar") + year ("2026") instead of date/weekday; vertical dashed line at column boundary
- Y-axis: gridlines at 0, half-max, max with mg labels
- Today highlighted; filled dot markers with white centres at each point
- Line connects all days including zero-intake days

### UI/UX
- **Primary device**: Mac (desktop browser)
- **Secondary device**: Android phone (when connectivity allows)
- **Level colour coding**:
  - 0–100mg: Green (Low)
  - 100–200mg: Yellow (Moderate)
  - 200–400mg: Orange (High)
  - 400+mg: Red (Very High)
- All buttons must have `type="button"` unless they are form submit buttons

### Auto-refresh
- 1-minute `setInterval` calls `refreshUI()`: current level, recent entries, 7-day chart, today's summary
- History chart (`drawHistoryChart()`) is **not** on the 1-minute tick — only redraws when data changes via `refreshAll()`
- TODO: review energy/battery impact of canvas redraws on the minute tick (see TASKS.md)

### Development Commands
```bash
npm run dev   # starts Express server on port 8080
```

Open `http://127.0.0.1:8080`. Hard refresh with `Cmd+Shift+R` after code changes to bypass service worker cache.

## Coding Standards
- ES6+ (const/let, arrow functions, template literals)
- All buttons outside forms must have `type="button"` explicitly
- Keep functions small and focused
- Meaningful variable names

## Browser Compatibility
- **Primary**: Mac Safari (current) — local server handles persistence; File System API unavailable but not needed
- **Primary**: Mac Chrome (current) — local server handles persistence; File System API also available for deployed version
- **Secondary**: Android Chrome (current, when network allows)

## LSHTM Note
This project is developed on an LSHTM machine. Before adding any cloud sync or external data storage (e.g. Firebase), review LSHTM's policies on third-party cloud services.

## Testing Checklist
- [ ] Works in Chrome and Safari on Mac
- [ ] `npm run dev` starts server; data saves to `data/caffeine_data.json` on each entry change
- [ ] Closing and reopening browser restores data from server file if localStorage is empty
- [ ] Calculations accurate (100mg after 5hrs → ~50mg)
- [ ] Peak level accounts for decay of earlier entries (not a raw sum)
- [ ] Half-life change instantly updates level display and entry list
- [ ] No console errors
- [ ] Preset buttons log immediately using current date/time input
- [ ] Future timestamps rejected with toast
- [ ] Timestamps older than 7 days rejected with toast
- [ ] Entries with < 1mg remaining hidden from Recent Entries but visible in charts
- [ ] Entries older than 7 days hidden from Recent Entries but visible in charts
- [ ] History chart scrolls horizontally when many days of data
- [ ] History chart renders crisply (no blurriness) in both Chrome and Safari
- [ ] Android: open `http://[MAC_IP]:8080` on same Wi-Fi
