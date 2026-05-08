# Quick Start Guide

## Prerequisites

- Node.js installed (`node --version` to check; if missing: `brew install node`)
- A modern browser (Safari or Chrome on Mac)

## Start the App

```bash
# From the caffeine-tracker directory
npm run dev
```

Then open `http://127.0.0.1:8080` in your browser.

---

## Using the App

### Pages

The app has three pages, navigated via the tab bar at the top: **Main**, **Analysis**, and **Live**.

### Logging caffeine (Main page)

The **Add Caffeine** section has date/time inputs at the top that apply to everything below:

- **Quick presets** — click Celsius, Huel, Neutonic, or Tenzing to log instantly at the selected date/time
- **Custom entry** — fill in amount (mg) and optional source, then hit Log Caffeine
- **Retrospective entry** — adjust the date/time inputs before logging; entries up to 7 days back are accepted; future timestamps are blocked

### Recent Entries

Shows entries still contributing meaningful caffeine (≥ 1 mg remaining, within 7 days). Older or fully decayed entries are hidden here but remain in all charts. Tap **View all** to open the full history editor where you can edit or delete any entry.

### Settings (⚙)

- **Half-life** — default 5 hours; adjusting this recalculates everything instantly
- **Dark mode** toggle
- **Backup/export** — download CSV or JSON; import from a backup file
- **Preview mode** — loads sample data into a temporary session so you can explore the app without affecting your real data

### Analysis page

28-day summary strip, 7-day forecast, time-of-day intake pattern, source breakdown, bedtime caffeine trend, and a daily heatmap.

### Live page

Animated real-time curve for the current caffeine episode. Shows past intake (solid line), projected decay (dashed), and labels each dose peak with its source.

---

## Troubleshooting

**Stale page after updates** — hard refresh with `Cmd+Shift+R` to bypass the service worker cache.

**Data missing after browser data clear** — if running locally via `npm run dev`, the app restores from `data/caffeine_data.json` automatically on next load.

**Accessing on a phone (same Wi-Fi)**

```bash
ipconfig getifaddr en0   # find your Mac's local IP
```

Open `http://[YOUR_MAC_IP]:8080` in the phone's browser.
