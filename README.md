# Caffeine Tracker

A Progressive Web App for tracking caffeine intake and calculating current caffeine levels using biological half-life decay.

## What It Does

- **Log caffeine** with amount, date/time, and source — including up to 7 days retrospectively
- **Quick Add presets** for common drinks (Celsius, Huel, Neutonic, Tenzing Mango)
- **Two-panel layout** — entry controls on the left, analytics on the right
- **Current level display** with colour-coded status (Low / Moderate / High / Very High)
- **Daily summary** — total consumed today, peak level, time of peak
- **7-day bar chart** — daily intake at a glance
- **Full history line chart** — every day since first use, scrollable
- **Custom half-life** — adjustable (default 5 hours), updates all calculations instantly
- **Local backup** — auto-saves to `data/caffeine_data.json` when running locally; restores on startup if localStorage is cleared
- **Works offline** — service worker caches assets
- **No accounts, no cloud, no tracking**

## Live App

**https://lukeburton02.github.io/caffeine-tracker/**

Anyone can open this in their browser — no install needed. Each user's data is stored in their own browser locally.

## Running Locally

```bash
npm run dev
```

Then open `http://127.0.0.1:8080`. Running locally starts an Express server that also saves data to disk (`data/caffeine_data.json`), so your data survives a localStorage clear.

## Project Structure

```
caffeine-tracker/
├── src/
│   ├── index.html         # App structure (two-panel layout)
│   ├── app.js             # All logic: calculations, storage, UI, analytics, backup
│   ├── styles.css         # Styling
│   ├── service-worker.js  # PWA offline support (network-first)
│   ├── manifest.json      # PWA config
│   └── icon.svg           # App icon
├── server.js              # Express dev server with /api/save and /api/load
├── CLAUDE.md              # Context for Claude Code
├── TASKS.md               # Full development history and roadmap
└── README.md              # This file
```

## The Science

Caffeine has a half-life of approximately **5 hours** in healthy adults (range: 3–7 hours). The app uses:

```
current_amount = initial_amount × (0.5 ^ (hours_elapsed / half_life))
```

Peak level is calculated at the exact moment each entry is consumed — the only point at which a local maximum can occur, since caffeine only decays from there. You can adjust the half-life in Settings; changes take effect immediately.

## Data Storage

- **localStorage** — primary runtime store; entries are never auto-deleted so the full history chart always has complete data
- **`data/caffeine_data.json`** — written automatically by the local Express server after every change; used to restore localStorage on startup if it was cleared
- The `data/` folder is gitignored — your caffeine data is never committed

## Tech Stack

- Vanilla JavaScript (ES6+)
- HTML5 / CSS3
- Express (local dev server for disk persistence)
- localStorage for runtime data
- Canvas API for charts (no libraries)
- Service Worker for PWA / offline support

## Deployment

Pushing to `main` automatically deploys to GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`). The `src/` folder is deployed to the `gh-pages` branch. The Express server and disk backup are local-only features.

## Note on Cloud Sync

This app is developed on an LSHTM machine. Before adding any cloud sync (e.g. Firebase), review LSHTM's policies on storing data with third-party cloud services.
