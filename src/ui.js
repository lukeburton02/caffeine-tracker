import { getHalfLife, calculateCurrentCaffeine } from './calculations.js';
import { getEntries } from './storage.js';

const HIGH_THRESHOLD = 200;

let prevCaffeineLevel = null;
let highWarningTimer = null;

export function getTotalCurrentCaffeine() {
    return getEntries().reduce((total, entry) => total + calculateCurrentCaffeine(entry), 0);
}

// --- Entry display filter ---
// Recent entries list shows only entries where caffeine >= 1mg AND age <= 7 days.
// This is a display filter only — entries remain in localStorage forever.

export function getDisplayEntries() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getEntries().filter(e => new Date(e.timestamp) >= sevenDaysAgo && calculateCurrentCaffeine(e) >= 1);
}

// --- Level display ---

function getLevelColor(mg) {
    if (mg < 100) return { color: '#27ae60', label: 'Low' };
    if (mg < 200) return { color: '#f39c12', label: 'Moderate' };
    if (mg < 400) return { color: '#e67e22', label: 'High' };
    return { color: '#e74c3c', label: 'Very High' };
}

export function updateLevelDisplay() {
    const total = getTotalCurrentCaffeine();
    const { color, label } = getLevelColor(total);

    document.getElementById('current-level').textContent = total.toFixed(1) + ' mg';
    document.getElementById('current-level').style.color = color;
    document.getElementById('level-status').textContent = label;
    document.getElementById('level-status').style.color = color;
    document.getElementById('last-updated').textContent =
        'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let pct;
    if (total >= 400)      pct = 100;
    else if (total >= 200) pct = 66 + ((total - 200) / 200) * 34;
    else if (total >= 100) pct = 33 + ((total - 100) / 100) * 33;
    else                   pct = (total / 100) * 33;

    const bar = document.getElementById('level-bar');
    bar.style.width = pct + '%';
    bar.style.background = color;
}

export function renderEntries() {
    const list = document.getElementById('entry-list');
    const entries = getDisplayEntries().slice().reverse();

    if (entries.length === 0) {
        list.innerHTML = '<li class="entry-empty">No active entries.</li>';
        return;
    }

    const today = new Date();
    list.innerHTML = entries.map(entry => {
        const current = calculateCurrentCaffeine(entry).toFixed(1);
        const entryDate = new Date(entry.timestamp);
        const isToday = entryDate.toDateString() === today.toDateString();

        let timeDisplay;
        if (isToday) {
            timeDisplay = entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            const datePart = entryDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
            const timePart = entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeDisplay = `${datePart}, ${timePart}`;
        }

        const source = entry.source || 'Unknown';
        return `
            <li class="entry-item">
                <div class="entry-info">
                    <span class="entry-source">${source}</span>
                    <span class="entry-time">${timeDisplay}</span>
                </div>
                <div class="entry-amounts">
                    <span class="entry-original">${entry.amount}mg</span>
                    <span class="entry-current">${current}mg now</span>
                </div>
                <button type="button" class="btn-delete" onclick="handleDelete('${entry.id}', '${source}')" aria-label="Delete entry">✕</button>
            </li>
        `;
    }).join('');
}

// --- Daily summary ---

function getDailySummary() {
    const entries = getEntries();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEntries = entries.filter(e => new Date(e.timestamp) >= startOfDay);
    const totalConsumed = todayEntries.reduce((sum, e) => sum + e.amount, 0);

    let peakMg = 0;
    let peakTime = null;

    // Peak can only occur at the exact moment an entry is consumed — after that
    // everything only decays. Check the total level at each today entry's timestamp.
    if (todayEntries.length > 0) {
        todayEntries.forEach(todayEntry => {
            const t = new Date(todayEntry.timestamp);
            const level = entries.reduce((sum, entry) => {
                const hoursElapsed = (t - new Date(entry.timestamp)) / (1000 * 60 * 60);
                if (hoursElapsed < 0) return sum;
                return sum + entry.amount * Math.pow(0.5, hoursElapsed / getHalfLife());
            }, 0);
            if (level > peakMg) { peakMg = level; peakTime = t; }
        });
    }

    return { totalConsumed, peakMg, peakTime };
}

export function updateSummary() {
    const { totalConsumed, peakMg, peakTime } = getDailySummary();
    document.getElementById('summary-total').textContent = totalConsumed > 0 ? totalConsumed + 'mg' : '—';
    document.getElementById('summary-peak').textContent = peakMg > 0 ? peakMg.toFixed(0) + 'mg' : '—';
    document.getElementById('summary-peak-time').textContent =
        peakTime ? peakTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

export function checkHighWarning() {
    const current = getTotalCurrentCaffeine();
    const crossed = prevCaffeineLevel !== null && prevCaffeineLevel < HIGH_THRESHOLD && current >= HIGH_THRESHOLD;
    prevCaffeineLevel = current;
    if (!crossed) return;
    const el = document.getElementById('high-warning');
    el.textContent = `⚠ High caffeine level — ${current.toFixed(0)}mg is above ${HIGH_THRESHOLD}mg`;
    el.classList.add('visible');
    clearTimeout(highWarningTimer);
    highWarningTimer = setTimeout(() => el.classList.remove('visible'), 10000);
}

export function updateHalfLifeDisplay() {
    document.getElementById('halflife-input').value = getHalfLife();
}

// --- History editor modal ---

export function openHistoryEditor() {
    renderHistoryEditor();
    document.getElementById('history-editor-modal').style.display = 'flex';
}

export function closeHistoryEditor() {
    document.getElementById('history-editor-modal').style.display = 'none';
}

export function renderHistoryEditor() {
    const entries = getEntries().slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const list = document.getElementById('history-editor-list');

    if (entries.length === 0) {
        list.innerHTML = '<p class="he-empty">No entries yet.</p>';
        return;
    }

    const groups = [];
    let currentKey = null;
    entries.forEach(entry => {
        const d = new Date(entry.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (key !== currentKey) { currentKey = key; groups.push({ date: d, entries: [] }); }
        groups[groups.length - 1].entries.push(entry);
    });

    const today = new Date();
    list.innerHTML = groups.map(group => {
        const d = group.date;
        const isToday = d.toDateString() === today.toDateString();
        const dateLabel = isToday
            ? 'Today'
            : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

        const entriesHTML = group.entries.map(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const source = entry.source || 'Unknown';
            return `<div class="he-entry">
                <span class="he-time">${time}</span>
                <span class="he-source">${source}</span>
                <span class="he-amount">${entry.amount}mg</span>
                <button type="button" class="he-delete" data-id="${entry.id}" data-source="${source.replace(/"/g, '&quot;')}">Delete</button>
            </div>`;
        }).join('');

        return `<div class="he-day-group"><div class="he-day-header">${dateLabel}</div>${entriesHTML}</div>`;
    }).join('');
}
