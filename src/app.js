// Caffeine Tracker - Main Application Logic

import { DEFAULT_HALF_LIFE_HOURS, HALFLIFE_KEY, getHalfLife, calculateCurrentCaffeine, computeLevelAt, getCaffeineAtTime } from './calculations.js';
import { STORAGE_KEY, getEntries, saveEntry, deleteEntry, saveBackup, initBackup, updateBackupStatus, linkBackupFolder, importFromBackupFile, exportCSV, exportJSON } from './storage.js';
import { showToast } from './toast.js';
import {
    drawWeeklyChart, drawForecast, drawSourceBreakdown, drawTimeOfDay,
    drawBedtimeCaffeine, drawHistoryChart, drawHeatmap, updateHistoryNav, buildHistoryDays,
    buildEpisodeCurve, startEpisodeAnimation, stopEpisodeAnimation, isEpisodeAnimating,
    getHistoryMode, setHistoryMode, getHistoryWindowOffset, setHistoryWindowOffset,
    getBedtimeTrendEnabled, setBedtimeTrendEnabled
} from './charts.js';
import {
    getTotalCurrentCaffeine, updateLevelDisplay, renderEntries,
    updateSummary, checkHighWarning, updateHalfLifeDisplay,
    updateAnalysisSummary,
    openHistoryEditor, closeHistoryEditor, renderHistoryEditor
} from './ui.js';
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
    drawHeatmap();
}

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
    updateAnalysisSummary();
    drawWeeklyChart();
    drawHistoryChart();
    drawForecast();
    drawTimeOfDay();
    drawSourceBreakdown();
    drawBedtimeCaffeine();
    drawHeatmap();
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
        navigator.serviceWorker.register('./service-worker.js');
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

    // Bedtime trend toggle
    document.getElementById('bedtime-trend-toggle').addEventListener('click', () => {
        const enabled = !getBedtimeTrendEnabled();
        setBedtimeTrendEnabled(enabled);
        document.getElementById('bedtime-trend-toggle').classList.toggle('active', enabled);
        drawBedtimeCaffeine();
    });

    // Minute tick: refresh level, entries, 7-day chart (not history chart)
    setInterval(refreshUI, 60 * 1000);
});
