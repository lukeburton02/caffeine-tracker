# Caffeine Tracker PWA

## Project Overview
A Progressive Web App for tracking caffeine intake and calculating current caffeine levels using biological half-life decay. The app runs as a static site served from `src/` via `npx http-server`.

## Tech Stack
- **Vanilla JavaScript** (ES6+, no frameworks)
- **HTML5 / CSS3**
- **localStorage** for data persistence (all entries kept forever — never auto-deleted)
- **IndexedDB** for storing the File System Access API directory handle (local backup)
- **Canvas API** for charts (7-day bar chart, full history line chart)
- **Service Worker** for PWA / offline support (network-first strategy)

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

**Important:** All entries are stored forever and never auto-deleted. This ensures charts always have full historical data.

### Entry Display Rules (not storage rules)
- **Recent Entries list**: shows entries where remaining caffeine >= 1mg AND age <= 7 days
- **Current level**: sums all entries (fully decayed ones contribute negligible amounts)
- **All charts**: use the full unfiltered entry list from localStorage

### Entry Timestamp Rules
- **Entry date/time**: separate date + time inputs (not time-only)
- **Future timestamps**: hard block — rejected with toast, not just warned
- **Maximum retrospective**: entries older than 7 days are rejected
- Presets use the current date/time input values and are subject to the same validation

### Preset Drinks
- Celsius: 200mg
- Huel: 100mg
- Neutonic: 120mg
- Tenzing Mango: 160mg

Clicking a preset immediately logs using the current date/time input values (both date and time). Subject to same validation as manual entry.

### Local File Backup (File System Access API)
- User links a folder once via a button in Settings
- The folder handle is persisted in IndexedDB
- `caffeine_data.json` is auto-written to that folder on every data change
- localStorage remains the source of truth — backup is write-only for now
- Backup file format: `{ version, lastSaved, entries, halfLife }`
- File System Access API only works in Chrome/Edge (not Safari) — show graceful message if unsupported

### Layout (V2)
Two-panel layout on desktop (>800px), stacked on mobile:

**Left panel:**
- Current caffeine level display (number + colour bar + status + last updated)
- Date + time input (shared by presets and custom entry)
- Quick Add presets
- Custom entry form
- Recent entries list
- Half-life settings

**Right panel:**
- Today's summary (total consumed, peak level, peak time)
- Last 7 days bar chart
- Full history line chart (scrollable, see below)

### History Line Chart
- Shows daily total caffeine consumed from first-ever entry to today
- X-axis: one column per day, 44px wide, horizontally scrollable container
- Day labels (bottom): "DD/MM" format (e.g. "31/03")
- Weekday labels (below date): short weekday name (e.g. "Tue")
- Month boundaries: when day is first of a new month (and not the very first data point), show "Mar" in place of the date label and "2026" in place of the weekday label; draw a vertical dashed line at that column's left boundary
- Y-axis: mg with gridlines (0, half-max, max)
- Today's point and label highlighted
- Filled dot markers (white centre) at each data point
- Line connects all points (including zero days)

### UI/UX
- **Primary device**: Mac (desktop browser)
- **Secondary device**: Android phone (when connectivity allows)
- **Level colour coding**:
  - 0–100mg: Green (Low)
  - 100–200mg: Yellow (Moderate)
  - 200–400mg: Orange (High)
  - 400+mg: Red (Very High)
- All buttons must have `type="button"` unless they are form submit buttons, to prevent accidental form submission

### Auto-refresh
- 1-minute interval refreshes: current level display, recent entries list, 7-day bar chart
- History chart: only redraws when data changes (not on the 1-minute tick)
- Review energy/battery impact of canvas redraws — tracked in TASKS.md Future Enhancements

### Development Commands
```bash
npm run dev   # starts http-server on port 8080
```

Open `http://127.0.0.1:8080` in browser. Hard refresh with `Cmd+Shift+R` after code changes to bypass service worker cache.

## Coding Standards
- ES6+ (const/let, arrow functions, template literals)
- All buttons outside forms must have `type="button"` explicitly
- Keep functions small and focused
- Meaningful variable names

## Browser Compatibility
- Primary: Mac Chrome (current) — File System Access API supported
- Secondary: Mac Safari (current) — File System Access API not supported, show fallback message
- Tertiary: Android Chrome (current, when network allows)

## LSHTM Note
This project is developed on an LSHTM machine. Before adding any cloud sync or external data storage (e.g. Firebase), review LSHTM's policies on third-party cloud services.

## Testing Checklist
- [ ] Works in Chrome/Safari on Mac
- [ ] Data persists after closing and reopening browser
- [ ] Calculations accurate (100mg after 5hrs → ~50mg)
- [ ] Half-life change instantly updates level display and entry list
- [ ] No console errors
- [ ] Presets log immediately using current date/time input
- [ ] Future timestamps rejected with toast
- [ ] Timestamps older than 7 days rejected with toast
- [ ] Entries with < 1mg remaining not shown in Recent Entries, but still in charts
- [ ] Entries older than 7 days not shown in Recent Entries, but still in charts
- [ ] History chart scrolls horizontally when many days of data
- [ ] Backup: linking a folder saves caffeine_data.json on each entry change
