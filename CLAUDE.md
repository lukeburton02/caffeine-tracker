# Caffeine Tracker PWA

## Project Overview
A Progressive Web App for tracking caffeine intake and calculating current caffeine levels using biological half-life decay. All phases of development are complete. The app runs as a static site served from `src/` via `npx http-server`.

## Tech Stack
- **Vanilla JavaScript** (ES6+, no frameworks)
- **HTML5 / CSS3**
- **localStorage** for data persistence
- **Canvas API** for the 7-day chart
- **Service Worker** for PWA / offline support (network-first strategy)

## Project Structure
```
caffeine-tracker/
├── src/
│   ├── index.html         # App structure
│   ├── app.js             # All logic: calculations, storage, UI, analytics
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

### Preset Drinks
- Celsius: 200mg
- Huel: 100mg
- Neutonic: 120mg
- Tenzing Mango: 160mg

Clicking a preset pre-fills the form (amount + source) and focuses the time field. The user confirms time and hits Log Caffeine.

### Entry Lifecycle
Entries are automatically removed when remaining caffeine drops below 1mg (~33hrs for 100mg at default half-life). A toast notification is shown when cleanup occurs.

### UI/UX
- **Primary device**: Mac (desktop browser)
- **Secondary device**: Android phone (when connectivity allows)
- **Level colour coding**:
  - 0–100mg: Green (Low)
  - 100–200mg: Yellow (Moderate)
  - 200–400mg: Orange (High)
  - 400+mg: Red (Very High)
- All buttons must have `type="button"` unless they are form submit buttons, to prevent accidental form submission

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
- Primary: Mac Chrome/Safari (current)
- Secondary: Android Chrome (current, when network allows)

## LSHTM Note
This project is developed on an LSHTM machine. Before adding any cloud sync or external data storage (e.g. Firebase), review LSHTM's policies on third-party cloud services.

## Testing Checklist
- [ ] Works in Chrome/Safari on Mac
- [ ] Data persists after closing and reopening browser
- [ ] Calculations accurate (100mg after 5hrs → ~50mg)
- [ ] Half-life change instantly updates level display and entry list
- [ ] No console errors
- [ ] Presets pre-fill form correctly
