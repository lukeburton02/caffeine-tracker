# Quick Start Guide

## Prerequisites

- Node.js installed (`node --version` to check; if missing: `brew install node`)
- A modern browser (Chrome or Safari on Mac)

## Start the App

```bash
# From the caffeine-tracker directory
npm run dev
```

Then open `http://127.0.0.1:8080` in your browser.

## Using the App

**Quick Add** — click a preset (Celsius, Huel, Neutonic, Tenzing) to pre-fill the form, adjust the time if needed, then hit Log Caffeine.

**Custom Entry** — fill in amount (mg), time, and optional source, then hit Log Caffeine.

**Half-life** — change in Settings at the bottom. Default is 5 hours. Saving recalculates everything instantly.

**Entries auto-expire** when the remaining caffeine drops below 1mg (~33 hours for a 100mg drink).

## Accessing on Android

Phone and Mac must be on the same Wi-Fi network. Find your Mac's IP:

```bash
ipconfig getifaddr en0
```

Then open `http://[YOUR_MAC_IP]:8080` in Chrome on Android.

## Troubleshooting

**Stale page after updates** — hard refresh with `Cmd+Shift+R`

**Android can't connect** — check both devices are on the same Wi-Fi; check Mac firewall (System Settings → Network → Firewall)

**Data missing after browser data clear** — entries live in localStorage, which is wiped with browser data. This is expected.
