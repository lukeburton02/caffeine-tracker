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

## Using the App

**Quick Add** — click a preset (Celsius, Huel, Neutonic, Tenzing) to log it immediately using the current date and time shown in the inputs. Adjust date/time first if needed.

**Custom Entry** — fill in amount (mg) and optional source, confirm date/time, then hit Log Caffeine.

**Retrospective entry** — change the date/time inputs to log something from earlier (up to 7 days back). Future timestamps are blocked.

**Recent Entries** — shows entries still contributing meaningful caffeine (>= 1mg remaining, within 7 days). Older or fully decayed entries are hidden from this list but remain in the charts.

**Half-life** — change in Settings. Default is 5 hours. Saving recalculates everything instantly.

**Local backup** — when running via `npm run dev`, data is automatically saved to `data/caffeine_data.json` in the project folder after every change. If localStorage is ever cleared, the app restores from this file on next load.

## Accessing on Android

Phone and Mac must be on the same Wi-Fi network. Find your Mac's IP:

```bash
ipconfig getifaddr en0
```

Then open `http://[YOUR_MAC_IP]:8080` in Chrome on Android.

## Troubleshooting

**Stale page after updates** — hard refresh with `Cmd+Shift+R` to bypass the service worker cache.

**Android can't connect** — check both devices are on the same Wi-Fi; check Mac firewall (System Settings → Network → Firewall).

**Data missing after browser data clear** — if running locally via `npm run dev`, the app will restore from `data/caffeine_data.json` automatically on next load.
