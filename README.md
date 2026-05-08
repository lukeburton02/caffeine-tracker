# Caffeine Tracker

A Progressive Web App for tracking caffeine intake and monitoring real-time caffeine levels using pharmacokinetic half-life decay.

**Live app → https://lukeburton02.github.io/caffeine-tracker/**

No install, no accounts, no cloud. All data stays in your browser.

---

## Pages

| Page | Contents |
|------|----------|
| **Main** | Current level display (animated arc indicator) · Add Caffeine section with date/time, quick-add presets, and custom entry form · Recent entries list with remaining mg · Today's summary — total consumed, peak level, peak time · 7-day bar chart · Full history line chart (scrollable, windowed or all-time) |
| **Analysis** | Summary strip: 28-day avg · usual peak · avg bedtime · all-time total · 7-day forecast with 80% prediction interval · Time-of-day intake pattern (weighted KDE) · Source breakdown histogram · Bedtime caffeine trend (LOESS smoothed, scrollable) · Daily caffeine heatmap (GitHub-style, personal quantile colour scale) |
| **Live** | Animated real-time caffeine curve for the current episode · Solid past curve · dashed future projection · pulsing now-dot · source label at each local peak |

---

## Caffeine Decay Model

Caffeine is eliminated via first-order kinetics:

$$C(t) = C_0 \times 0.5^{t / t_{1/2}}$$

| Symbol | Meaning |
|--------|---------|
| $C(t)$ | Caffeine remaining at time $t$ (mg) |
| $C_0$ | Initial dose (mg) |
| $t$ | Hours elapsed since consumption |
| $t_{1/2}$ | Half-life (default **5 hours**; configurable 1–24 h in Settings) |

The total caffeine at any moment sums over all logged entries. Peak is sampled at the exact timestamp of each entry consumed today — the only moment a local maximum can occur.

**Typical half-life values:**

| Population | $t_{1/2}$ |
|------------|-----------|
| Healthy non-smoker adult | 3–5 hours |
| Oral contraceptive users | ~6–12 hours |
| Smokers | ~3 hours |
| Pregnancy (third trimester) | ~15 hours |

---

## Analysis Page Models

### 7-Day Forecast — Holt-Winters Triple Exponential Smoothing

When ≥ 14 days of history exist, uses the **additive Holt-Winters** model with weekly seasonality ($m = 7$). Falls back to double exponential smoothing when < 14 days are available.

80% prediction interval: $\hat{y} \pm 1.28 \times \text{RMSE} \times \sqrt{h}$

### Time-of-Day Pattern — Weighted KDE

Gaussian kernel per entry, scaled by mg amount. Bandwidth via Silverman's rule (clamped 0.4–2.5 hrs), with wrap-around at midnight.

### Bedtime Caffeine

Estimates $\text{Total}(23{:}00)$ for each day in history. Long histories show a LOESS-style Gaussian-smoothed trend line with ±1 SD band.

---

## Data Storage

```
App starts
  → Local Express server running? → load from data/caffeine_data.json, auto-save on change
  → No → showDirectoryPicker available (Chrome/Edge)? → File System Access API
  → No → localStorage only (Safari, Firefox, all GitHub Pages users)
```

localStorage is always the runtime source of truth. Entries are never auto-deleted. The recent entries list filters to ≥ 1 mg remaining and ≤ 7 days old for display, but all entries contribute to calculations and charts.

---

## Running Locally

```bash
npm run dev
```

Opens at `http://127.0.0.1:8080`. The Express server writes `data/caffeine_data.json` and `data/caffeine_data.csv` on every change.

## Project Structure

```
caffeine-tracker/
├── src/
│   ├── index.html            # Three-page PWA shell
│   ├── app.js                # Event wiring, navigation, init
│   ├── calculations.js       # Half-life decay math
│   ├── storage.js            # localStorage, Express API, File System Access, preview mode
│   ├── toast.js              # Toast notification helper
│   ├── charts-shared.js      # Shared colour helpers
│   ├── charts-main.js        # Weekly bar + full history line chart
│   ├── charts-analysis.js    # Forecast, KDE, source breakdown, bedtime, heatmap
│   ├── charts-episode.js     # Live episode animation
│   ├── ui.js                 # DOM updates: level arc, entries, summary, history editor
│   ├── styles.css            # Layout and components
│   ├── styles-modals.css     # Modals, settings, dark mode overrides
│   ├── service-worker.js     # PWA (network-first)
│   ├── manifest.json         # PWA config
│   ├── icon.svg / icon-192.png / icon-512.png
│   └── ...
├── data/
│   ├── caffeine_data.json    # Committed sample data
│   └── caffeine_data.csv
├── server.js                 # Express dev server
├── .github/workflows/deploy.yml
├── CLAUDE.md
├── TASKS.md
└── README.md
```

## Tech Stack

- **Vanilla JS** (ES modules, no framework, no bundler)
- **Canvas API** for all charts
- **localStorage** as primary runtime store
- **Express** (local dev only) for disk persistence
- **Service Worker** for PWA installability
- **GitHub Actions** → **GitHub Pages** for deployment

Every push to `main` deploys `src/` directly — no build step.

---

*Developed on an LSHTM machine. Before adding cloud sync, review LSHTM's policies on third-party data storage.*
