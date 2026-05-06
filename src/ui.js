import { getHalfLife, calculateCurrentCaffeine, getCaffeineAtTime } from './calculations.js';
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

// --- Analysis summary strip ---

export function updateAnalysisSummary() {
    const el = document.getElementById('analysis-summary');
    if (!el) return;
    const entries = getEntries();
    if (entries.length === 0) { el.textContent = ''; return; }

    const now = new Date();
    const halfLife = getHalfLife();
    const DAYS = 28;

    // 28-day daily average
    const cutoff = new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000);
    const total28 = entries.filter(e => new Date(e.timestamp) >= cutoff).reduce((s, e) => s + e.amount, 0);
    const avg28 = Math.round(total28 / DAYS);

    // Usual peak time: median peak across days that had entries, rounded to nearest 30 min
    const peakMinutes = [];
    for (let i = 0; i < DAYS; i++) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const dayEntries = entries.filter(e => { const t = new Date(e.timestamp); return t >= dayStart && t < dayEnd; });
        if (dayEntries.length === 0) continue;
        let peakMg = 0, peakTime = null;
        dayEntries.forEach(de => {
            const t = new Date(de.timestamp);
            const level = entries.reduce((sum, e) => {
                const h = (t - new Date(e.timestamp)) / 3600000;
                return h < 0 ? sum : sum + e.amount * Math.pow(0.5, h / halfLife);
            }, 0);
            if (level > peakMg) { peakMg = level; peakTime = t; }
        });
        if (peakTime) peakMinutes.push(peakTime.getHours() * 60 + peakTime.getMinutes());
    }
    let peakStr = '—';
    if (peakMinutes.length > 0) {
        peakMinutes.sort((a, b) => a - b);
        const median = peakMinutes[Math.floor(peakMinutes.length / 2)];
        const rounded = Math.round(median / 30) * 30;
        const h = Math.floor(rounded / 60) % 24;
        const m = rounded % 60;
        const ampm = h >= 12 ? 'pm' : 'am';
        peakStr = `${h % 12 || 12}:${String(m).padStart(2, '0')}${ampm}`;
    }

    // Average bedtime caffeine (last 28 days)
    let bedtimeSum = 0;
    for (let i = 0; i < DAYS; i++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        bedtimeSum += getCaffeineAtTime(entries, new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 0, 0));
    }
    const avgBedtime = Math.round(bedtimeSum / DAYS);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const oldest = entries.reduce((min, e) => new Date(e.timestamp) < min ? new Date(e.timestamp) : min, new Date(entries[0].timestamp));
    const sinceLabel = `${MONTHS[oldest.getMonth()]} ${oldest.getFullYear()}`;
    const allTimeTotal = entries.reduce((s, e) => s + e.amount, 0);
    const allTimeTotalStr = allTimeTotal >= 1000 ? (allTimeTotal / 1000).toFixed(1) + 'g' : allTimeTotal + 'mg';

    el.innerHTML =
        `<span>28-day avg: <strong>${avg28}mg</strong></span>` +
        `<span class="summary-sep">·</span>` +
        `<span>Usual peak: <strong>${peakStr}</strong></span>` +
        `<span class="summary-sep">·</span>` +
        `<span>Avg bedtime: <strong>${avgBedtime}mg</strong></span>` +
        `<span class="summary-sep">·</span>` +
        `<span>Total since ${sinceLabel}: <strong>${allTimeTotalStr}</strong></span>`;
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
