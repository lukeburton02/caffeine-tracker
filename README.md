# Caffeine Tracker

A Progressive Web App for tracking caffeine intake and calculating current caffeine levels using biological half-life decay.

## What It Does

- **Log caffeine** with amount, time, and source
- **Quick Add presets** for common drinks (Celsius, Huel, Neutonic, Tenzing Mango)
- **Current level display** with colour-coded status (Low / Moderate / High / Very High)
- **Daily summary** — total consumed, peak level, time of peak
- **7-day chart** — bar chart of daily intake
- **Auto-cleanup** — entries with <1mg remaining are automatically removed
- **Custom half-life** — adjustable (default 5 hours), updates all calculations instantly
- **Works offline** — service worker caches assets
- **Local storage only** — no accounts, no cloud, no tracking

## Running Locally

```bash
npm run dev
```

Then open `http://127.0.0.1:8080` in your browser.

## Project Structure

```
caffeine-tracker/
├── src/
│   ├── index.html         # App structure
│   ├── app.js             # All logic: calculations, storage, UI, analytics
│   ├── styles.css         # Styling
│   ├── service-worker.js  # PWA offline support (network-first)
│   ├── manifest.json      # PWA config
│   └── icon.svg           # App icon
├── CLAUDE.md              # Context for Claude Code
├── TASKS.md               # Full development history and roadmap
└── README.md              # This file
```

## The Science

Caffeine has a half-life of approximately **5 hours** in healthy adults (range: 3–7 hours). The app uses:

```
current_amount = initial_amount × (0.5 ^ (hours_elapsed / half_life))
```

You can adjust the half-life in the Settings section. Changes take effect immediately on all displayed values.

## Data Storage

All data is stored in your browser's **localStorage**, tied to `http://127.0.0.1:8080`. It persists across browser sessions but is local to your machine and browser profile. Clearing browser data will erase entries.

## Tech Stack

- Vanilla JavaScript (ES6+)
- HTML5 / CSS3
- localStorage for persistence
- Canvas API for the weekly chart
- Service Worker for PWA / offline support
- No frameworks or libraries

## Development Status

All planned phases are complete. See TASKS.md for full history.

**Remaining future enhancements:**
- Notifications when caffeine drops below a threshold
- CSV export
- Dark mode
- Cloud sync *(requires LSHTM policy review first)*

## Note on Cloud Sync

This app is developed on an LSHTM machine. Before adding any cloud sync (e.g. Firebase), review LSHTM's policies on storing data with third-party cloud services.
