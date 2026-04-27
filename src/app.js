// Caffeine Tracker - Main Application Logic

import { DEFAULT_HALF_LIFE_HOURS, HALFLIFE_KEY, getHalfLife, calculateCurrentCaffeine, computeLevelAt, getCaffeineAtTime } from './calculations.js';
import { STORAGE_KEY, getEntries, saveEntry, deleteEntry, saveBackup, initBackup, updateBackupStatus, linkBackupFolder, importFromBackupFile, exportCSV, exportJSON } from './storage.js';
import { showToast } from './toast.js';
import {
    drawWeeklyChart, drawForecast, drawSourceBreakdown, drawTimeOfDay,
    drawBedtimeCaffeine, drawHistoryChart, updateHistoryNav, buildHistoryDays,
    buildEpisodeCurve, startEpisodeAnimation, stopEpisodeAnimation, isEpisodeAnimating,
    getHistoryMode, setHistoryMode, getHistoryWindowOffset, setHistoryWindowOffset
} from './charts.js';
const HIGH_THRESHOLD = 200; // mg — warn once when crossing above this

let prevCaffeineLevel = null;
let highWarningTimer = null;

const THEME_KEY = 'caffeine_theme';

function applyTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.checked = dark;
    drawWeeklyChart();
    drawHistoryChart();
    drawForecast();
    drawTimeOfDay();
    drawSourceBreakdown();
    drawBedtimeCaffeine();
}

// --- Caffeine calculation ---

function getTotalCurrentCaffeine() {
    return getEntries().reduce((total, entry) => {
        return total + calculateCurrentCaffeine(entry);
    }, 0);
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

    // Peak can only occur at the exact moment an entry is consumed — after that
    // everything only decays. Check the total level at each today entry's timestamp.
    if (todayEntries.length > 0) {
        const allEntries = getEntries();

        todayEntries.forEach(todayEntry => {
            const t = new Date(todayEntry.timestamp);
            const level = allEntries.reduce((sum, entry) => {
                const hoursElapsed = (t - new Date(entry.timestamp)) / (1000 * 60 * 60);
                if (hoursElapsed < 0) return sum;
                return sum + entry.amount * Math.pow(0.5, hoursElapsed / getHalfLife());
            }, 0);
            if (level > peakMg) {
                peakMg = level;
                peakTime = t;
            }
        });
    }

    return { totalConsumed, peakMg, peakTime };
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

function checkHighWarning() {
    const current = getTotalCurrentCaffeine();
    const crossed = prevCaffeineLevel !== null
        && prevCaffeineLevel < HIGH_THRESHOLD
        && current >= HIGH_THRESHOLD;
    prevCaffeineLevel = current;

    if (!crossed) return;

    const el = document.getElementById('high-warning');
    el.textContent = `⚠ High caffeine level — ${current.toFixed(0)}mg is above ${HIGH_THRESHOLD}mg`;
    el.classList.add('visible');
    clearTimeout(highWarningTimer);
    highWarningTimer = setTimeout(() => el.classList.remove('visible'), 10000);
}

function updateHalfLifeDisplay() {
    document.getElementById('halflife-input').value = getHalfLife();
}

// refreshUI: called every minute — updates level, entries, 7-day chart, summary.
// History chart is NOT redrawn here (only when data changes) to avoid unnecessary canvas work.
// Called every minute: only updates values that change with time (decay).
// Charts and summary only change when entries are added/deleted — see refreshAll().
function refreshUI() {
    updateLevelDisplay();
    checkHighWarning();
    renderEntries();
    if (isEpisodeAnimating()) buildEpisodeCurve(); // only when episode page is active
}

// Called when data changes (entry added/deleted, half-life changed).
function refreshAll() {
    updateLevelDisplay();
    checkHighWarning();
    updateSummary();
    drawWeeklyChart();
    drawHistoryChart();
    drawForecast();
    drawTimeOfDay();
    drawSourceBreakdown();
    drawBedtimeCaffeine();
    buildEpisodeCurve();
    renderEntries();
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
window.handleDelete = handleDelete;

// --- History editor modal ---

function openHistoryEditor() {
    renderHistoryEditor();
    document.getElementById('history-editor-modal').style.display = 'flex';
}

function closeHistoryEditor() {
    document.getElementById('history-editor-modal').style.display = 'none';
}

function renderHistoryEditor() {
    const entries = getEntries().slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const list = document.getElementById('history-editor-list');

    if (entries.length === 0) {
        list.innerHTML = '<p class="he-empty">No entries yet.</p>';
        return;
    }

    // Group by calendar day
    const groups = [];
    let currentKey = null;
    entries.forEach(entry => {
        const d = new Date(entry.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (key !== currentKey) {
            currentKey = key;
            groups.push({ date: d, entries: [] });
        }
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

        return `<div class="he-day-group">
            <div class="he-day-header">${dateLabel}</div>
            ${entriesHTML}
        </div>`;
    }).join('');
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
    initBackup({
        onDataLoaded: () => { updateHalfLifeDisplay(); refreshAll(); },
        updateBackupStatus
    });

    document.getElementById('log-form').addEventListener('submit', handleFormSubmit);

    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            handlePreset(parseFloat(btn.dataset.amount), btn.dataset.source);
        });
    });

    // Theme toggle
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') applyTheme(true);
    document.getElementById('theme-toggle').addEventListener('change', e => applyTheme(e.target.checked));

    document.getElementById('halflife-save').addEventListener('click', saveHalfLife);
    document.getElementById('halflife-reset').addEventListener('click', resetHalfLife);
    document.getElementById('backup-link').addEventListener('click', linkBackupFolder);
    document.getElementById('import-backup').addEventListener('click', () => {
        document.getElementById('import-backup-file').click();
    });
    document.getElementById('import-backup-file').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) importFromBackupFile(file, { onImport: () => { updateHalfLifeDisplay(); refreshAll(); } });
        e.target.value = '';
    });
    document.getElementById('export-csv').addEventListener('click', exportCSV);
    document.getElementById('export-json').addEventListener('click', exportJSON);

    // Settings modal
    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('open-settings').addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });
    document.getElementById('close-settings').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    settingsModal.addEventListener('click', e => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    });

    document.getElementById('open-history-editor').addEventListener('click', openHistoryEditor);
    document.getElementById('close-history-editor').addEventListener('click', closeHistoryEditor);
    document.getElementById('history-editor-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeHistoryEditor();
    });
    document.getElementById('history-editor-list').addEventListener('click', e => {
        const btn = e.target.closest('.he-delete');
        if (!btn) return;
        const { id, source } = btn.dataset;
        if (!confirm(`Delete "${source}"?`)) return;
        deleteEntry(id);
        refreshAll();
        renderHistoryEditor();
    });

    document.getElementById('history-mode-all').addEventListener('click', () => {
        setHistoryMode('all');
        document.getElementById('history-mode-all').classList.add('active');
        document.getElementById('history-mode-window').classList.remove('active');
        updateHistoryNav();
        drawHistoryChart();
    });

    document.getElementById('history-mode-window').addEventListener('click', () => {
        setHistoryMode('window');
        setHistoryWindowOffset(0);
        document.getElementById('history-mode-window').classList.add('active');
        document.getElementById('history-mode-all').classList.remove('active');
        updateHistoryNav();
        drawHistoryChart();
    });

    document.getElementById('history-prev').addEventListener('click', () => {
        const allDays = buildHistoryDays();
        setHistoryWindowOffset(Math.min(getHistoryWindowOffset() + 7, allDays.length - 1));
        updateHistoryNav();
        drawHistoryChart();
    });

    document.getElementById('history-next').addEventListener('click', () => {
        setHistoryWindowOffset(Math.max(getHistoryWindowOffset() - 7, 0));
        updateHistoryNav();
        drawHistoryChart();
    });

    // Page navigation (3 pages: 0=main, 1=analysis, 2=episode)
    const pagesTrack = document.getElementById('pages-track');
    const tabBtns    = document.querySelectorAll('.tab-btn');
    let currentPage  = 0;

    const PAGE_TRACK_CLASS = [null, 'on-analysis', 'on-episode'];

    function navigateTo(page) {
        pagesTrack.classList.remove('on-analysis', 'on-episode');
        if (PAGE_TRACK_CLASS[page]) pagesTrack.classList.add(PAGE_TRACK_CLASS[page]);

        tabBtns.forEach(btn => btn.classList.toggle('active', +btn.dataset.page === page));

        if (page === 2) {
            buildEpisodeCurve();
            startEpisodeAnimation();
        } else {
            stopEpisodeAnimation();
        }
        currentPage = page;
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => navigateTo(+btn.dataset.page));
    });

    // Forecast panel info tooltip (click toggle)
    const infoBtn     = document.getElementById('forecast-info-btn');
    const infoTooltip = document.getElementById('forecast-tooltip');
    if (infoBtn && infoTooltip) {
        infoBtn.addEventListener('click', () => infoTooltip.classList.toggle('visible'));
    }

    // Minute tick: refresh level, entries, 7-day chart (not history chart)
    setInterval(refreshUI, 60 * 1000);
});
