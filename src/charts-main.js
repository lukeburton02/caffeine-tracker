import { getEntries } from './storage.js';
import { isDarkMode, getChartColors } from './charts-shared.js';

// --- History chart state ---
// Exported via getters/setters because ES module bindings are read-only from importers.

let historyMode = 'all';
let historyWindowOffset = 0;

export function getHistoryMode() { return historyMode; }
export function setHistoryMode(m) { historyMode = m; }
export function getHistoryWindowOffset() { return historyWindowOffset; }
export function setHistoryWindowOffset(v) { historyWindowOffset = v; }

// --- Weekly chart ---

function getWeeklyTotals() {
    const entries = getEntries();
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
        const label = i === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });
        const total = entries
            .filter(e => { const t = new Date(e.timestamp); return t >= date && t < nextDate; })
            .reduce((sum, e) => sum + e.amount, 0);
        days.push({ label, total });
    }
    return days;
}

export function drawWeeklyChart() {
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

    const C = getChartColors();
    days.forEach((day, i) => {
        const x = padLeft + i * gap + gap / 2;
        const barH = day.total > 0 ? (day.total / max) * chartH : 0;
        const y = padTop + chartH - barH;

        const isToday = day.label === 'Today';
        ctx.fillStyle = isToday ? '#667eea' : C.barNormal;
        ctx.beginPath();
        ctx.roundRect(x - barW / 2, y, barW, barH, 4);
        ctx.fill();

        if (day.total > 0) {
            ctx.fillStyle = isToday ? '#667eea' : C.barLabelNormal;
            ctx.font = `${isToday ? 600 : 400} 10px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(day.total + 'mg', x, y - 3);
        }

        ctx.fillStyle = isToday ? C.todayLabel : C.barLabelNormal;
        ctx.font = `${isToday ? 600 : 400} 11px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(day.label, x, cssHeight - 8);
    });
}

// --- Full history line chart ---

export function buildHistoryDays() {
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
            .filter(e => { const t = new Date(e.timestamp); return t >= cursor && t < next; })
            .reduce((sum, e) => sum + e.amount, 0);
        days.push({ date: new Date(cursor), total });
        cursor = next;
    }
    return days;
}

function getHistoryWindowDays(allDays) {
    if (allDays.length === 0) return [];
    const endIdx = Math.max(0, allDays.length - 1 - historyWindowOffset);
    const startIdx = Math.max(0, endIdx - 13);
    return allDays.slice(startIdx, endIdx + 1);
}

export function updateHistoryNav() {
    const allDays = buildHistoryDays();
    const nav = document.getElementById('history-nav');
    if (!nav) return;
    if (historyMode !== 'window') { nav.style.display = 'none'; return; }
    nav.style.display = 'flex';
    const windowDays = getHistoryWindowDays(allDays);
    const label = document.getElementById('history-window-label');
    if (windowDays.length > 0) {
        const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        label.textContent = `${fmt(windowDays[0].date)} – ${fmt(windowDays[windowDays.length - 1].date)}`;
    }
    document.getElementById('history-prev').disabled = historyWindowOffset >= allDays.length - 1;
    document.getElementById('history-next').disabled = historyWindowOffset <= 0;
}

export function drawHistoryChart() {
    const canvas = document.getElementById('history-chart');
    const emptyMsg = document.getElementById('history-empty');
    if (!canvas) return;

    const allDays = buildHistoryDays();
    const days = historyMode === 'window' ? getHistoryWindowDays(allDays) : allDays;
    updateHistoryNav();

    if (days.length === 0) {
        canvas.style.display = 'none';
        emptyMsg.style.display = '';
        return;
    }
    canvas.style.display = 'block';
    emptyMsg.style.display = 'none';

    const PAD_LEFT = 50, PAD_RIGHT = 20, PAD_TOP = 20, PAD_BOTTOM = 66, CHART_H = 150;
    const containerW = canvas.parentElement.clientWidth || 300;
    const DAY_W = historyMode === 'window'
        ? Math.max(30, Math.floor((containerW - PAD_LEFT - PAD_RIGHT) / days.length))
        : 44;
    const daysW = PAD_LEFT + days.length * DAY_W + PAD_RIGHT;
    const cssW = historyMode === 'window' ? containerW : Math.max(containerW, daysW);
    const cssH = PAD_TOP + CHART_H + PAD_BOTTOM;

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const maxVal = Math.max(...days.map(d => d.total), 100);
    const scaleY = val => PAD_TOP + CHART_H - (val / maxVal) * CHART_H;
    const dayX = i => PAD_LEFT + i * DAY_W + DAY_W / 2;
    const C = getChartColors();

    const gridSteps = [0, Math.round(maxVal / 2), maxVal];
    gridSteps.forEach(v => {
        const y = scaleY(v);
        ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_LEFT, y); ctx.lineTo(cssW - PAD_RIGHT, y); ctx.stroke();
        // In window mode the overlay is hidden so draw labels on main canvas; in all-time mode
        // the overlay draws its own labels, so skip here to avoid anything leaking under the overlay.
        if (historyMode !== 'all') {
            ctx.fillStyle = C.yLabel; ctx.font = '10px sans-serif';
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText(v + 'mg', PAD_LEFT - 5, y);
        }
    });

    const yAxis = document.getElementById('history-yaxis');
    if (yAxis && historyMode === 'all') {
        yAxis.style.display = 'block';
        yAxis.style.width = PAD_LEFT + 'px';
        yAxis.style.height = cssH + 'px';
        yAxis.width = Math.round(PAD_LEFT * dpr);
        yAxis.height = Math.round(cssH * dpr);
        const yCtx = yAxis.getContext('2d');
        yCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        yCtx.clearRect(0, 0, PAD_LEFT, cssH);
        gridSteps.forEach(v => {
            const y = scaleY(v);
            yCtx.strokeStyle = C.gridLine; yCtx.lineWidth = 1;
            yCtx.beginPath(); yCtx.moveTo(0, y); yCtx.lineTo(PAD_LEFT, y); yCtx.stroke();
            yCtx.fillStyle = C.yLabel; yCtx.font = '10px sans-serif';
            yCtx.textAlign = 'right'; yCtx.textBaseline = 'middle';
            yCtx.fillText(v + 'mg', PAD_LEFT - 5, y);
        });
    } else if (yAxis) {
        yAxis.style.display = 'none';
    }

    days.forEach((day, i) => {
        if (i > 0 && day.date.getDate() === 1) {
            const x = PAD_LEFT + i * DAY_W;
            ctx.strokeStyle = C.boundaryLine; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.moveTo(x, PAD_TOP); ctx.lineTo(x, PAD_TOP + CHART_H); ctx.stroke();
            ctx.setLineDash([]);
        }
    });

    if (days.length > 1) {
        ctx.strokeStyle = '#667eea'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        ctx.beginPath();
        days.forEach((day, i) => { const x = dayX(i), y = scaleY(day.total); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
    }

    days.forEach((day, i) => {
        const x = dayX(i), y = scaleY(day.total);
        const isToday = i === days.length - 1;
        ctx.beginPath(); ctx.arc(x, y, isToday ? 5 : 4, 0, Math.PI * 2); ctx.fillStyle = '#667eea'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, isToday ? 3 : 2, 0, Math.PI * 2); ctx.fillStyle = C.dotCenter; ctx.fill();
    });

    const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labelY1 = PAD_TOP + CHART_H + 12;
    const labelY2 = PAD_TOP + CHART_H + 24;
    const labelY3 = PAD_TOP + CHART_H + 40;
    const labelY4 = PAD_TOP + CHART_H + 52;

    days.forEach((day, i) => {
        if (i > 0 && day.date.getDate() === 1) {
            const bx = PAD_LEFT + i * DAY_W;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#667eea'; ctx.font = '600 11px sans-serif';
            ctx.fillText(MONTHS[day.date.getMonth()], bx, labelY3);
            ctx.fillStyle = C.monthYear; ctx.font = '10px sans-serif';
            ctx.fillText(day.date.getFullYear(), bx, labelY4);
        }
    });

    const tickInterval = days.length <= 21 ? 1 : days.length <= 60 ? 7 : days.length <= 180 ? 14 : 28;
    days.forEach((day, i) => {
        const isToday = i === days.length - 1;
        if (!isToday && i % tickInterval !== 0) return;
        const x = dayX(i);
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const d = String(day.date.getDate()).padStart(2,'0');
        const m = String(day.date.getMonth() + 1).padStart(2,'0');
        ctx.fillStyle = isToday ? C.todayLabel : C.dateLabel;
        ctx.font = `${isToday ? '600' : '400'} 10px sans-serif`;
        ctx.fillText(`${d}/${m}`, x, labelY1);
        ctx.fillStyle = isToday ? '#667eea' : C.weekdayLabel;
        ctx.font = `${isToday ? '600' : '400'} 10px sans-serif`;
        ctx.fillText(WEEKDAYS[day.date.getDay()], x, labelY2);
    });

    if (historyMode === 'all') {
        const container = document.getElementById('history-chart-container');
        if (container) container.scrollLeft = container.scrollWidth;
    }
}
