# ☕ Caffeine Tracker

A Progressive Web App for tracking your caffeine intake and calculating current caffeine levels in your system using biological half-life decay.

## What It Does

- **Log caffeine intake** anytime with amount and time
- **Calculate current caffeine** in your system using the 5-hour half-life
- **Store data locally** on your phone (no cloud, no accounts, no tracking)
- **Works offline** once installed as a PWA
- **Install to home screen** on Android - feels like a native app

## Quick Start

### 1. Development Setup

```bash
# Make sure you have Node.js installed
node --version  # Should show v18 or higher

# Navigate to project
cd caffeine-tracker

# Start a local server
npx http-server src -p 8080
```

### 2. Access on Your Android Phone

1. Find your computer's local IP address:
   - **Mac**: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - **Linux**: `hostname -I`
   - **Windows**: `ipconfig` (look for IPv4 Address)

2. Make sure your phone is on the **same WiFi network** as your computer

3. On your Android phone, open Chrome and go to:
   ```
   http://[YOUR_IP_ADDRESS]:8080
   ```
   Example: `http://192.168.1.100:8080`

### 3. Install as PWA (After Phase 3 is complete)

1. In Chrome on Android, tap the menu (⋮)
2. Tap "Add to Home screen"
3. The app will now appear in your app drawer like a native app!

## Project Structure

```
caffeine-tracker/
├── src/
│   ├── index.html         # Main app interface
│   ├── app.js             # Core logic & calculations
│   ├── styles.css         # Mobile-first styling
│   ├── service-worker.js  # PWA offline support
│   └── manifest.json      # PWA configuration
├── CLAUDE.md              # Context for Claude Code
├── TASKS.md               # Development roadmap
└── README.md              # This file
```

## Using Claude Code

From the project directory:

```bash
claude-code
```

Then ask Claude to work on tasks from TASKS.md:

```
Work on Task 1.2 - create the basic HTML structure
```

Claude Code will read CLAUDE.md automatically and understand the project context.

## The Science: Caffeine Half-Life

Caffeine has a half-life of approximately **5 hours** in healthy adults. This means:

- 100mg at 12:00pm → ~50mg at 5:00pm → ~25mg at 10:00pm
- Formula: `current = initial × (0.5 ^ (hours_elapsed / 5))`

## Development Phases

- ✅ **Phase 1**: Core functionality (MVP)
- ⬜ **Phase 2**: Enhanced UX
- ⬜ **Phase 3**: PWA features  
- ⬜ **Phase 4**: Analytics & insights
- ⬜ **Future**: Cloud sync for Mac access

See TASKS.md for detailed breakdown.

## Tech Stack

- **Vanilla JavaScript** (ES6+)
- **HTML5** & **CSS3**
- **LocalStorage API** for persistence
- **Service Workers** for PWA functionality
- **No frameworks/libraries** (keeping it simple!)

## Testing

Key tests to verify before marking tasks complete:
- [ ] Calculations match expected values
- [ ] Data persists after closing browser
- [ ] Works on Android Chrome
- [ ] No console errors
- [ ] Responsive on phone screen

## Future Plans

1. **Cloud Sync** (Firebase) - Access from Mac
2. **Native Android App** (low priority) - Eventually convert to React Native or Flutter
3. **Notifications** - Alert when caffeine drops below threshold
4. **Historical Analytics** - Track patterns over time

## License

Personal project - do whatever you want with it!
