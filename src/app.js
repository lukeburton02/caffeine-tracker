// Caffeine Tracker - Main Application Logic

const DEFAULT_HALF_LIFE_HOURS = 5;
const STORAGE_KEY = 'caffeine_entries';
const HALFLIFE_KEY = 'caffeine_halflife';

function getHalfLife() {
    const stored = parseFloat(localStorage.getItem(HALFLIFE_KEY));
    return isNaN(stored) ? DEFAULT_HALF_LIFE_HOURS : stored;
}

// --- Caffeine calculation ---

function calculateCurrentCaffeine(entry) {
    const now = new Date();
    const consumed = new Date(entry.timestamp);
    const hoursElapsed = (now - consumed) / (1000 * 60 * 60);
    return entry.amount * Math.pow(0.5, hoursElapsed / getHalfLife());
}

function getTotalCurrentCaffeine() {
    return getEntries().reduce((total, entry) => {
        return total + calculateCurrentCaffeine(entry);
    }, 0);
}

// --- LocalStorage ---
// All entries are kept forever — never auto-deleted — so charts always have full history.

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
        saveBackup();
    } catch {
        showToast('Could not save entry — storage may be full');
    }
}

function deleteEntry(id) {
    try {
        const entries = getEntries().filter(e => e.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        saveBackup();
    } catch {
        showToast('Could not delete entry');
    }
}

// --- Entry display filter ---
// Recent entries list shows only entries where caffeine >= 1mg AND age <= 7 days.
// This is a display filter only — entries remain in localStorage forever.

function getDisplayEntries() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getEntries().filter(e => {
        return new Date(e.timestamp) >= sevenDaysAgo && calculateCurrentCaffeine(e) >= 1;
    });
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

    document.getElementById('current-level').textContent = total.toFixed(1) + ' mg';
    document.getElementById('current-level').style.color = color;
    document.getElementById('level-status').textContent = label;
    document.getElementById('level-status').style.color = color;
    document.getElementById('last-updated').textContent =
        'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let pct;
    if (total >= 400) {
        pct = 100;
    } else if (total >= 200) {
        pct = 66 + ((total - 200) / 200) * 34;
    } else if (total >= 100) {
        pct = 33 + ((total - 100) / 100) * 33;
    } else {
        pct = (total / 100) * 33;
    }

    const bar = document.getElementById('level-bar');
    bar.style.width = pct + '%';
    bar.style.background = color;
}

function renderEntries() {
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

// --- Full history line chart ---

function buildHistoryDays() {
    const entries = getEntries();
    if (entries.length === 0) return [];

    const allTimestamps = entries.map(e => new Date(e.timestamp));
    const firstEntry = new Date(Math.min(...allTimestamps));
    const today = new Date();

    const start = new Date(firstEntry.getFullYear(), firstEntry.getMonth(), firstEntry.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const days = [];
    let cursor = new Date(start);
    while (cursor <= end) {
        const next = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
        const total = entries
            .filter(e => {
                const t = new Date(e.timestamp);
                return t >= cursor && t < next;
            })
            .reduce((sum, e) => sum + e.amount, 0);
        days.push({ date: new Date(cursor), total });
        cursor = next;
    }
    return days;
}

function drawHistoryChart() {
    const canvas = document.getElementById('history-chart');
    const emptyMsg = document.getElementById('history-empty');
    if (!canvas) return;

    const days = buildHistoryDays();

    if (days.length === 0) {
        canvas.style.display = 'none';
        emptyMsg.style.display = '';
        return;
    }

    canvas.style.display = 'block';
    emptyMsg.style.display = 'none';

    const DAY_W = 44;
    const PAD_LEFT = 50;
    const PAD_RIGHT = 20;
    const PAD_TOP = 20;
    const PAD_BOTTOM = 52;
    const CHART_H = 150;

    // Canvas is at least as wide as its container (so it renders at full resolution
    // even with few data points), and wider when there are many days (triggers scroll).
    const containerW = canvas.parentElement.clientWidth || 300;
    const daysW = PAD_LEFT + days.length * DAY_W + PAD_RIGHT;
    const cssW = Math.max(containerW, daysW);
    const cssH = PAD_TOP + CHART_H + PAD_BOTTOM;

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const ctx = canvas.getContext('2d');
    // Explicitly set transform (not just scale) so there's no ambiguity about state
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const maxVal = Math.max(...days.map(d => d.total), 100);
    const scaleY = val => PAD_TOP + CHART_H - (val / maxVal) * CHART_H;
    const dayX = i => PAD_LEFT + i * DAY_W + DAY_W / 2;

    // Y-axis gridlines and labels
    const gridSteps = [0, Math.round(maxVal / 2), maxVal];
    gridSteps.forEach(v => {
        const y = scaleY(v);
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, y);
        ctx.lineTo(cssW - PAD_RIGHT, y);
        ctx.stroke();

        ctx.fillStyle = '#ccc';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(v + 'mg', PAD_LEFT - 5, y);
    });

    // Month boundary vertical dashed lines
    days.forEach((day, i) => {
        if (i > 0 && day.date.getDate() === 1) {
            const x = PAD_LEFT + i * DAY_W;
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(x, PAD_TOP);
            ctx.lineTo(x, PAD_TOP + CHART_H);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });

    // Line connecting data points
    if (days.length > 1) {
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        days.forEach((day, i) => {
            const x = dayX(i);
            const y = scaleY(day.total);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    // Data point dots
    days.forEach((day, i) => {
        const x = dayX(i);
        const y = scaleY(day.total);
        const isToday = i === days.length - 1;
        const outerR = isToday ? 5 : 4;
        const innerR = isToday ? 3 : 2;

        ctx.beginPath();
        ctx.arc(x, y, outerR, 0, Math.PI * 2);
        ctx.fillStyle = '#667eea';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, innerR, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
    });

    // X-axis labels
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const labelY1 = PAD_TOP + CHART_H + 12; // date or month name
    const labelY2 = PAD_TOP + CHART_H + 28; // weekday or year

    days.forEach((day, i) => {
        const x = dayX(i);
        const isMonthBoundary = i > 0 && day.date.getDate() === 1;
        const isToday = i === days.length - 1;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        if (isMonthBoundary) {
            ctx.fillStyle = '#667eea';
            ctx.font = '600 11px sans-serif';
            ctx.fillText(MONTHS[day.date.getMonth()], x, labelY1);
            ctx.fillStyle = '#999';
            ctx.font = '10px sans-serif';
            ctx.fillText(day.date.getFullYear(), x, labelY2);
        } else {
            const d = String(day.date.getDate()).padStart(2, '0');
            const m = String(day.date.getMonth() + 1).padStart(2, '0');
            ctx.fillStyle = isToday ? '#2c3e50' : '#bbb';
            ctx.font = `${isToday ? '600' : '400'} 10px sans-serif`;
            ctx.fillText(`${d}/${m}`, x, labelY1);
            ctx.fillStyle = isToday ? '#667eea' : '#ccc';
            ctx.font = `${isToday ? '600' : '400'} 10px sans-serif`;
            ctx.fillText(WEEKDAYS[day.date.getDay()], x, labelY2);
        }
    });
}

function updateHalfLifeDisplay() {
    document.getElementById('halflife-input').value = getHalfLife();
}

// refreshUI: called every minute — updates level, entries, 7-day chart, summary.
// History chart is NOT redrawn here (only when data changes) to avoid unnecessary canvas work.
function refreshUI() {
    updateLevelDisplay();
    updateSummary();
    drawWeeklyChart();
    renderEntries();
}

// Called when data changes (entry added/deleted, half-life changed).
function refreshAll() {
    refreshUI();
    drawHistoryChart();
}

// --- Event handlers ---

function handleFormSubmit(e) {
    e.preventDefault();

    const amountInput = document.getElementById('amount');
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

    const timestamp = getEntryTimestamp();
    if (!validateTimestamp(timestamp)) return;

    const entry = {
        id: Date.now().toString(),
        timestamp: timestamp.toISOString(),
        amount,
        source: sourceInput.value.trim() || 'Unknown'
    };

    saveEntry(entry);
    refreshAll();
    showToast(`Logged ${amount}mg`);

    amountInput.value = '';
    sourceInput.value = '';
}

function handleDelete(id, source) {
    if (!confirm(`Delete "${source}"?`)) return;
    deleteEntry(id);
    refreshAll();
}

// --- Toast ---

function showToast(message) {
    const toast = document.getElementById('preset-toast');
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
}

// --- Preset quick-add ---

function handlePreset(amount, source) {
    const timestamp = getEntryTimestamp();
    if (!validateTimestamp(timestamp)) return;

    const entry = {
        id: Date.now().toString(),
        timestamp: timestamp.toISOString(),
        amount,
        source
    };

    saveEntry(entry);
    refreshAll();
    showToast(`Logged ${source} (${amount}mg)`);
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
    saveBackup();
    refreshAll();
    showToast(`Half-life set to ${value} hours — levels recalculated`);
}

function resetHalfLife() {
    localStorage.removeItem(HALFLIFE_KEY);
    updateHalfLifeDisplay();
    saveBackup();
    refreshAll();
    showToast(`Half-life reset to ${DEFAULT_HALF_LIFE_HOURS} hours`);
}

// --- Date/time input ---

function setDefaultDateTime() {
    const now = new Date();

    // Set date input to today
    document.getElementById('entry-date').value = toDateInputValue(now);
    // Set time input to now
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('entry-time').value = `${hh}:${mm}`;

    // Constrain date range
    const maxDate = now;
    const minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    document.getElementById('entry-date').max = toDateInputValue(maxDate);
    document.getElementById('entry-date').min = toDateInputValue(minDate);
}

function toDateInputValue(date) {
    // Returns "YYYY-MM-DD" in local time (not UTC)
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getEntryTimestamp() {
    const dateVal = document.getElementById('entry-date').value;
    const timeVal = document.getElementById('entry-time').value;
    if (!dateVal || !timeVal) return new Date();
    const [y, mo, d] = dateVal.split('-').map(Number);
    const [h, mi] = timeVal.split(':').map(Number);
    return new Date(y, mo - 1, d, h, mi, 0, 0);
}

function validateTimestamp(ts) {
    const now = new Date();
    if (ts > now) {
        showToast('Cannot log future entries');
        return false;
    }
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (ts < sevenDaysAgo) {
        showToast('Cannot log entries older than 7 days');
        return false;
    }
    return true;
}

// --- IndexedDB helpers (for storing backup folder handle) ---

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('caffeine-tracker', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('settings');
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject(new Error('IndexedDB unavailable'));
    });
}

async function getDBValue(key) {
    try {
        const db = await openDB();
        return new Promise(resolve => {
            const tx = db.transaction('settings', 'readonly');
            const req = tx.objectStore('settings').get(key);
            req.onsuccess = e => resolve(e.target.result ?? null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function setDBValue(key, value) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readwrite');
            const req = tx.objectStore('settings').put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e.target.error);
        });
    } catch {
        // Silently fail — backup is optional
    }
}

// --- File System Access API backup ---

let backupDirHandle = null;

async function initBackup() {
    if (!window.showDirectoryPicker) {
        // File System Access API not supported (Safari, Firefox) — hide the row entirely
        const row = document.querySelector('.backup-row');
        const note = document.getElementById('backup-note');
        if (row) row.style.display = 'none';
        if (note) note.style.display = 'none';
        return;
    }
    backupDirHandle = await getDBValue('backupDir');
    updateBackupStatus();
}

async function linkBackupFolder() {
    if (!window.showDirectoryPicker) {
        showToast('Folder backup requires Chrome or Edge');
        return;
    }
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        backupDirHandle = handle;
        await setDBValue('backupDir', handle);
        updateBackupStatus();
        await saveBackup();
        showToast('Folder linked — data saved');
    } catch (e) {
        if (e.name !== 'AbortError') showToast('Could not link folder');
    }
}

async function saveBackup() {
    if (!backupDirHandle) return;
    try {
        let perm = await backupDirHandle.queryPermission({ mode: 'readwrite' });
        if (perm === 'prompt') {
            perm = await backupDirHandle.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') return;

        const fileHandle = await backupDirHandle.getFileHandle('caffeine_data.json', { create: true });
        const writable = await fileHandle.createWritable();
        const data = {
            version: 1,
            lastSaved: new Date().toISOString(),
            entries: getEntries(),
            halfLife: getHalfLife()
        };
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
    } catch (e) {
        console.warn('Backup save failed:', e.message);
    }
}

function updateBackupStatus() {
    const el = document.getElementById('backup-status');
    if (!el) return;
    if (backupDirHandle) {
        el.textContent = `${backupDirHandle.name}/caffeine_data.json`;
        el.className = 'backup-status backup-linked';
    } else {
        el.textContent = 'Not linked';
        el.className = 'backup-status';
    }
}

// --- Service Worker ---

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js');
    });
}

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDateTime();
    updateHalfLifeDisplay();
    refreshAll();
    initBackup();

    document.getElementById('log-form').addEventListener('submit', handleFormSubmit);

    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            handlePreset(parseFloat(btn.dataset.amount), btn.dataset.source);
        });
    });

    document.getElementById('halflife-save').addEventListener('click', saveHalfLife);
    document.getElementById('halflife-reset').addEventListener('click', resetHalfLife);
    document.getElementById('backup-link').addEventListener('click', linkBackupFolder);

    // Minute tick: refresh level, entries, 7-day chart (not history chart)
    setInterval(refreshUI, 60 * 1000);
});
