# Caffeine Tracker PWA

## Project Overview
A Progressive Web App (PWA) for tracking caffeine intake and calculating current caffeine levels in your system using biological half-life decay.

## Tech Stack
- **Vanilla JavaScript** (no frameworks initially - keep it simple)
- **HTML5** for structure
- **CSS3** for styling
- **LocalStorage** for data persistence
- **Service Worker** for PWA functionality (offline support)

## Project Structure
```
caffeine-tracker/
├── src/
│   ├── index.html       # Main HTML file
│   ├── app.js           # Core application logic
│   ├── styles.css       # Styling
│   └── service-worker.js # PWA offline support
├── public/              # Built files (will be generated)
├── CLAUDE.md           # This file
└── TASKS.md            # Development tasks
```

## Key Requirements

### Caffeine Calculation
- **Half-life**: Use 5 hours (standard for healthy adults)
- **Formula**: `current_amount = initial_amount * (0.5 ^ (hours_elapsed / 5))`
- **Precision**: Show results to 1 decimal place (e.g., "45.3 mg")

### Data Structure
Store entries in localStorage as JSON array:
```javascript
{
  entries: [
    {
      id: "timestamp_unique",
      timestamp: "2026-03-30T14:30:00Z",
      amount: 95,  // mg of caffeine
      source: "Coffee" // optional description
    }
  ]
}
```

### UI/UX Guidelines
- **Primary device**: Mac (desktop browser)
- **Secondary device**: Android phone (mobile browser, when connectivity allows)
- **Responsive design**: Works well on desktop first, mobile second
- **Large touch targets**: Minimum 44px for buttons (still good practice)
- **Clear contrast**: Ensure text is readable
- **Quick entry**: Should take <10 seconds to log caffeine
- **Current level prominent**: Main screen shows current caffeine level in large text

### Common Caffeine Amounts (for quick entry)
- Celsius: 200mg
- Huel: 100mg
- Neutonic: 120mg
- Tenzing Mango: 160mg

## Development Commands

### Local Development
```bash
# Start a local server (install if needed: npm install -g http-server)
npx http-server src -p 8080

# Or use Python if you have it
python3 -m http.server 8080 --directory src
```

Then open on your Android phone by visiting: `http://[your-computer-ip]:8080`

### Testing PWA Installation
1. Open in Chrome on Android
2. Check for "Install app" prompt
3. Verify it works offline

## Coding Standards
- Use ES6+ JavaScript features (const/let, arrow functions, template literals)
- Add comments for complex calculations
- Keep functions small and focused
- Use meaningful variable names (e.g., `caffeineHalfLifeHours` not `h`)

## Browser Compatibility
- Primary: Mac Chrome/Safari (current version)
- Secondary: Android Chrome (current version, when network allows)

## Testing Checklist
Before marking any task complete:
- [ ] Works in Chrome/Safari on Mac
- [ ] Data persists after closing browser
- [ ] Calculations are accurate (test with known values)
- [ ] No console errors
- [ ] UI is responsive (desktop first, mobile when possible)

## Notes for Claude
- When creating files, put them in `src/` directory
- Keep the initial version simple - we'll add features incrementally
- Focus on core functionality before making it fancy
- Remember: This is for a first-time app builder, so clarity > cleverness
