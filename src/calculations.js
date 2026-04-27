export const DEFAULT_HALF_LIFE_HOURS = 5;
export const HALFLIFE_KEY = 'caffeine_halflife';

export function getHalfLife() {
    const stored = parseFloat(localStorage.getItem(HALFLIFE_KEY));
    return isNaN(stored) ? DEFAULT_HALF_LIFE_HOURS : stored;
}

export function calculateCurrentCaffeine(entry) {
    const now = new Date();
    const consumed = new Date(entry.timestamp);
    const hoursElapsed = (now - consumed) / (1000 * 60 * 60);
    return entry.amount * Math.pow(0.5, hoursElapsed / getHalfLife());
}

// Pure level calculation — takes entries array and half-life in milliseconds.
// Used by episode page to avoid repeated getHalfLife() calls in tight loops.
export function computeLevelAt(tMs, entries, halfLifeMs) {
    return entries.reduce((sum, e) => {
        const age = tMs - new Date(e.timestamp).getTime();
        return age < 0 ? sum : sum + e.amount * Math.pow(0.5, age / halfLifeMs);
    }, 0);
}

export function getCaffeineAtTime(entries, targetTime) {
    return entries.reduce((sum, e) => {
        const consumed = new Date(e.timestamp);
        if (consumed >= targetTime) return sum;
        const hoursElapsed = (targetTime - consumed) / (1000 * 60 * 60);
        return sum + e.amount * Math.pow(0.5, hoursElapsed / getHalfLife());
    }, 0);
}
