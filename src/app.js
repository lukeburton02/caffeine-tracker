// Caffeine Tracker - Main Application Logic

const DEFAULT_HALF_LIFE_HOURS = 5;
const STORAGE_KEY = 'caffeine_entries';
const HALFLIFE_KEY = 'caffeine_halflife';

function getHalfLife() {
    const stored = parseFloat(localStorage.getItem(HALFLIFE_KEY));
    return isNaN(stored) ? DEFAULT_HALF_LIFE_HOURS : stored;
}

// --- Caffeine calculation ---

// Returns how much caffeine from a single entry remains right now
function calculateCurrentCaffeine(entry) {
    const now = new Date();
    const consumed = new Date(entry.timestamp);
    const hoursElapsed = (now - consumed) / (1000 * 60 * 60);
    return entry.amount * Math.pow(0.5, hoursElapsed / getHalfLife());
}

// Returns total current caffeine from all entries
function getTotalCurrentCaffeine() {
    return getEntries().reduce((total, entry) => {
        return total + calculateCurrentCaffeine(entry);
    }, 0);
}

// --- LocalStorage ---

function getEntries() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveEntry(entry) {
    try {
        const entries = getEntries();
        entries.push(entry);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        showToast('Could not save entry — storage may be full');
    }
}

function deleteEntry(id) {
    try {
        const entries = getEntries().filter(e => e.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        showToast('Could not delete entry');
    }
}

// --- UI updates ---

function getLevelColor(mg) {
    if (mg < 100) return { color: '#27ae60', label: 'Low' };
    if (mg < 200) return { color: '#f39c12', label: 'Moderate' };
    if (mg < 400) return { color: '#e67e22', label: 'High' };
    return { color: '#e74c3c', label: 'Very High' };
}

function updateLevelDisplay() {
    const total = getTotalCurrentCaffeine();
    const { color, label } = getLevelColor(total);
    const maxMg = 500;

    document.getElementById('current-level').textContent = total.toFixed(1) + ' mg';
    document.getElementById('current-level').style.color = color;
    document.getElementById('level-status').textContent = label;
    document.getElementById('level-status').style.color = color;
    document.getElementById('last-updated').textContent =
        'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const bar = document.getElementById('level-bar');
    const pct = Math.min((total / maxMg) * 100, 100);
    bar.style.width = pct + '%';
    bar.style.background = color;
}

function renderEntries() {
    const list = document.getElementById('entry-list');
    const entries = getEntries().slice().reverse();

    if (entries.length === 0) {
        list.innerHTML = '<li class="entry-empty">No entries yet. Log your first caffeine above!</li>';
        return;
    }

    list.innerHTML = entries.map(entry => {
        const current = calculateCurrentCaffeine(entry).toFixed(1);
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const source = entry.source || 'Unknown';
        return `
            <li class="entry-item">
                <div class="entry-info">
                    <span class="entry-source">${source}</span>
                    <span class="entry-time">${time}</span>
                </div>
                <div class="entry-amounts">
                    <span class="entry-original">${entry.amount}mg</span>
                    <span class="entry-current">${current}mg now</span>
                </div>
                <button class="btn-delete" onclick="handleDelete('${entry.id}', '${source}')" aria-label="Delete entry">✕</button>
            </li>
        `;
    }).join('');
}

// --- Analytics ---

function getDailySummary() {
    const entries = getEntries();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayEntries = entries.filter(e => new Date(e.timestamp) >= startOfDay);
    const totalConsumed = todayEntries.reduce((sum, e) => sum + e.amount, 0);

    let peakMg = 0;
    let peakTime = null;

    if (todayEntries.length > 0) {
        const firstEntry = new Date(Math.min(...todayEntries.map(e => new Date(e.timestamp))));
        const allEntries = getEntries();
        let cursor = new Date(firstEntry);

        while (cursor <= now) {
            const level = allEntries.reduce((sum, entry) => {
                const hoursElapsed = (cursor - new Date(entry.timestamp)) / (1000 * 60 * 60);
                if (hoursElapsed < 0) return sum;
                return sum + entry.amount * Math.pow(0.5, hoursElapsed / getHalfLife());
            }, 0);

            if (level > peakMg) {
                peakMg = level;
                peakTime = new Date(cursor);
            }
            cursor = new Date(cursor.getTime() + 15 * 60 * 1000);
        }
    }

    return { totalConsumed, peakMg, peakTime };
}

function getWeeklyTotals() {
    const entries = getEntries();
    const today = new Date();
    const days = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
        const label = i === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });
        const total = entries
            .filter(e => {
                const t = new Date(e.timestamp);
                return t >= date && t < nextDate;
            })
            .reduce((sum, e) => sum + e.amount, 0);
        days.push({ label, total });
    }
    return days;
}

function updateSummary() {
    const { totalConsumed, peakMg, peakTime } = getDailySummary();

    document.getElementById('summary-total').textContent =
        totalConsumed > 0 ? totalConsumed + 'mg' : '—';
    document.getElementById('summary-peak').textContent =
        peakMg > 0 ? peakMg.toFixed(0) + 'mg' : '—';
    document.getElementById('summary-peak-time').textContent =
        peakTime ? peakTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

function drawWeeklyChart() {
    const canvas = document.getElementById('weekly-chart');
    const ctx = canvas.getContext('2d');
    const days = getWeeklyTotals();
    const max = Math.max(...days.map(d => d.total), 200);

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.parentElement.clientWidth;
    const cssHeight = 160;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);

    const padLeft = 8, padRight = 8, padTop = 12, padBottom = 32;
    const chartW = cssWidth - padLeft - padRight;
    const chartH = cssHeight - padTop - padBottom;
    const barW = chartW / days.length * 0.5;
    const gap = chartW / days.length;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    days.forEach((day, i) => {
        const x = padLeft + i * gap + gap / 2;
        const barH = day.total > 0 ? (day.total / max) * chartH : 0;
        const y = padTop + chartH - barH;

        const isToday = day.label === 'Today';
        ctx.fillStyle = isToday ? '#667eea' : '#c5cff7';
        ctx.beginPath();
        ctx.roundRect(x - barW / 2, y, barW, barH, 4);
        ctx.fill();

        if (day.total > 0) {
            ctx.fillStyle = isToday ? '#667eea' : '#999';
            ctx.font = `${isToday ? 600 : 400} 10px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(day.total + 'mg', x, y - 3);
        }

        ctx.fillStyle = isToday ? '#2c3e50' : '#999';
        ctx.font = `${isToday ? 600 : 400} 11px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(day.label, x, cssHeight - 8);
    });
}

function updateHalfLifeDisplay() {
    document.getElementById('halflife-input').value = getHalfLife();
}

function refreshUI() {
    cleanupDecayedEntries();
    updateLevelDisplay();
    updateSummary();
    drawWeeklyChart();
    renderEntries();
}

// --- Event handlers ---

function handleFormSubmit(e) {
    e.preventDefault();

    const amountInput = document.getElementById('amount');
    const timeInput = document.getElementById('time');
    const sourceInput = document.getElementById('source');

    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount');
        return;
    }
    if (amount > 2000) {
        showToast('Amount seems too high — max 2000mg');
        return;
    }

    const [hours, minutes] = timeInput.value.split(':').map(Number);
    const timestamp = new Date();
    timestamp.setHours(hours, minutes, 0, 0);

    if (timestamp > new Date()) {
        showToast('Note: time is in the future');
    }

    const entry = {
        id: Date.now().toString(),
        timestamp: timestamp.toISOString(),
        amount,
        source: sourceInput.value.trim() || 'Unknown'
    };

    saveEntry(entry);
    refreshUI();
    showToast(`Logged ${amount}mg`);

    amountInput.value = '';
    sourceInput.value = '';
    setDefaultTime();
}

function handleDelete(id, source) {
    if (!confirm(`Delete "${source}"?`)) return;
    deleteEntry(id);
    refreshUI();
}

// --- Entry cleanup ---

function cleanupDecayedEntries() {
    const entries = getEntries();
    const active = entries.filter(e => calculateCurrentCaffeine(e) >= 1);
    const removed = entries.length - active.length;
    if (removed > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
        showToast(`${removed} fully decayed entr${removed === 1 ? 'y' : 'ies'} removed`);
    }
}

// --- Toast ---

function showToast(message) {
    const toast = document.getElementById('preset-toast');
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
}

// --- Preset quick-add ---

// Pre-fills the form with the preset values and scrolls to the time field
function handlePreset(amount, source) {
    document.getElementById('amount').value = amount;
    document.getElementById('source').value = source;
    setDefaultTime();

    const timeInput = document.getElementById('time');
    timeInput.focus();
    timeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });

    showToast(`${source} selected — confirm time and tap Log`);
}

// --- Half-life settings ---

function saveHalfLife() {
    const input = document.getElementById('halflife-input');
    const value = parseFloat(input.value);
    if (isNaN(value) || value < 1 || value > 24) {
        showToast('Half-life must be between 1 and 24 hours');
        return;
    }
    localStorage.setItem(HALFLIFE_KEY, value);
    refreshUI();
    showToast(`Half-life set to ${value} hours — levels recalculated`);
}

function resetHalfLife() {
    localStorage.removeItem(HALFLIFE_KEY);
    updateHalfLifeDisplay();
    refreshUI();
    showToast(`Half-life reset to ${DEFAULT_HALF_LIFE_HOURS} hours`);
}

// --- Init ---

function setDefaultTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('time').value = `${hh}:${mm}`;
}

// --- Service Worker ---

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setDefaultTime();
    updateHalfLifeDisplay();
    refreshUI();

    document.getElementById('log-form').addEventListener('submit', handleFormSubmit);

    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            handlePreset(parseFloat(btn.dataset.amount), btn.dataset.source);
        });
    });

    document.getElementById('halflife-save').addEventListener('click', saveHalfLife);
    document.getElementById('halflife-reset').addEventListener('click', resetHalfLife);

    setInterval(refreshUI, 60 * 1000);
});
