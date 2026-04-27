import { getHalfLife, computeLevelAt, getCaffeineAtTime } from './calculations.js';
import { getEntries } from './storage.js';

// --- Theme helpers ---

function isDarkMode() {
    return document.documentElement.dataset.theme === 'dark';
}

function getChartColors() {
    const dark = isDarkMode();
    return {
        gridLine:        dark ? '#2a2b3e' : '#f0f0f0',
        yLabel:          dark ? '#52536e' : '#ccc',
        boundaryLine:    dark ? '#32334e' : '#ddd',
        dateLabel:       dark ? '#52536e' : '#bbb',
        weekdayLabel:    dark ? '#3e3f58' : '#ccc',
        todayLabel:      dark ? '#e2e4f0' : '#2c3e50',
        dotCenter:       dark ? '#1a1b2e' : 'white',
        barNormal:       dark ? '#3a3d6e' : '#c5cff7',
        barLabelNormal:  dark ? '#9a9bb8' : '#999',
        monthYear:       dark ? '#52536e' : '#aaa',
    };
}

// --- History chart state ---
// Exported via getters/setters because ES module bindings are read-only from importers.

let historyMode = 'all';       // 'all' | 'window'
let historyWindowOffset = 0;   // days before today for the window end (0 = today)
let bedtimeTrendEnabled = false;

export function getHistoryMode() { return historyMode; }
export function setHistoryMode(m) { historyMode = m; }
export function getHistoryWindowOffset() { return historyWindowOffset; }
export function setHistoryWindowOffset(v) { historyWindowOffset = v; }
export function getBedtimeTrendEnabled() { return bedtimeTrendEnabled; }
export function setBedtimeTrendEnabled(v) { bedtimeTrendEnabled = v; }

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

// --- 7-day forecast (Holt-Winters triple exponential smoothing) ---

const TES_ALPHA  = 0.3;
const TES_BETA   = 0.1;
const TES_GAMMA  = 0.2;
const TES_PERIOD = 7;

function weekdayIdx(d) { return (d.getDay() + 6) % 7; }

function fitDES(values) {
    if (values.length < 1) return null;
    let L = values[0];
    let T = values.length > 1
        ? (values[Math.min(values.length - 1, 3)] - values[0]) / Math.min(values.length - 1, 3)
        : 0;
    const residuals = [];
    for (let i = 1; i < values.length; i++) {
        const fcast = L + T;
        residuals.push(values[i] - fcast);
        const Lprev = L;
        L = TES_ALPHA * values[i] + (1 - TES_ALPHA) * (L + T);
        T = TES_BETA  * (L - Lprev) + (1 - TES_BETA) * T;
    }
    return { L, T, residuals, type: 'des' };
}

function fitTES(values, dates) {
    if (values.length < TES_PERIOD * 2) return fitDES(values);
    const m = TES_PERIOD;
    const A1 = values.slice(0, m).reduce((a, b) => a + b, 0) / m;
    const A2 = values.slice(m, m * 2).reduce((a, b) => a + b, 0) / m;
    let L = A1;
    let T = (A2 - A1) / m;
    const S = new Array(m).fill(0);
    for (let i = 0; i < m; i++) S[weekdayIdx(dates[i])] = values[i] - A1;
    const residuals = [];
    for (let i = 0; i < values.length; i++) {
        const wd = weekdayIdx(dates[i]);
        if (i > 0) residuals.push(values[i] - (L + T + S[wd]));
        const Lprev = L;
        L = TES_ALPHA * (values[i] - S[wd]) + (1 - TES_ALPHA) * (L + T);
        T = TES_BETA  * (L - Lprev)          + (1 - TES_BETA)  * T;
        S[wd] = TES_GAMMA * (values[i] - L)  + (1 - TES_GAMMA) * S[wd];
    }
    return { L, T, S, residuals, type: 'tes' };
}

export function drawForecast() {
    const canvas = document.getElementById('forecast-chart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssWidth = wrap.clientWidth;
    const cssHeight = wrap.clientHeight;
    if (cssWidth < 10 || cssHeight < 10) return;

    const C = getChartColors();
    const dark = isDarkMode();
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const allDays = buildHistoryDays();
    if (allDays.length === 0) {
        ctx.fillStyle = C.yLabel;
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No entries yet', cssWidth / 2, cssHeight / 2);
        return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const completedDays = allDays.filter(d => d.date < todayStart);
    const todayDay = allDays.find(d => d.date.getTime() === todayStart.getTime());

    const model = fitTES(completedDays.map(d => d.total), completedDays.map(d => d.date));

    const HORIZON = 7;
    const rmse = model && model.residuals.length > 1
        ? Math.sqrt(model.residuals.reduce((s, r) => s + r * r, 0) / model.residuals.length)
        : (model ? Math.max(model.L * 0.3, 30) : 50);

    const forecastPts = model ? Array.from({ length: HORIZON }, (_, h) => {
        const date = new Date(todayStart.getTime() + (h + 1) * 86400000);
        const seasonal = model.type === 'tes' ? model.S[weekdayIdx(date)] : 0;
        const point = Math.max(0, model.L + (h + 1) * model.T + seasonal);
        const hw = 1.28 * rmse * Math.sqrt(h + 1);
        return { date, point, lo: Math.max(0, point - hw), hi: point + hw };
    }) : [];

    const contextDays = completedDays.slice(-14);
    const N_CTX  = contextDays.length;
    const N_FCST = forecastPts.length;
    const N_COLS = N_CTX + 1 + N_FCST;

    const PAD_L = 50, PAD_R = 16, PAD_T = 24, PAD_B = 32;
    const chartW = cssWidth - PAD_L - PAD_R;
    const chartH = cssHeight - PAD_T - PAD_B;
    const DAY_W = chartW / N_COLS;
    const colX = i => PAD_L + i * DAY_W + DAY_W / 2;

    const maxVal = Math.max(
        ...contextDays.map(d => d.total),
        todayDay ? todayDay.total : 0,
        ...forecastPts.map(f => f.hi),
        100
    );
    const scaleY = v => PAD_T + chartH - Math.max(0, Math.min(v, maxVal)) / maxVal * chartH;

    [0, Math.round(maxVal / 2), Math.round(maxVal)].forEach(v => {
        const y = scaleY(v);
        ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + chartW, y); ctx.stroke();
        ctx.fillStyle = C.yLabel; ctx.font = '10px sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(v + 'mg', PAD_L - 5, y);
    });

    const sepX = PAD_L + (N_CTX + 1) * DAY_W;
    ctx.strokeStyle = C.boundaryLine; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(sepX, PAD_T); ctx.lineTo(sepX, PAD_T + chartH); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = dark ? 'rgba(102,126,234,0.45)' : 'rgba(102,126,234,0.5)';
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('forecast →', PAD_L + (N_CTX + 1) * DAY_W + (N_FCST * DAY_W) / 2, PAD_T + 2);

    if (forecastPts.length > 0) {
        ctx.fillStyle = dark ? 'rgba(102,126,234,0.13)' : 'rgba(102,126,234,0.10)';
        ctx.beginPath();
        forecastPts.forEach((f, i) => {
            const x = colX(N_CTX + 1 + i), y = scaleY(f.hi);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        [...forecastPts].reverse().forEach((f, i) => {
            ctx.lineTo(colX(N_CTX + 1 + (N_FCST - 1 - i)), scaleY(f.lo));
        });
        ctx.closePath(); ctx.fill();

        ctx.strokeStyle = dark ? 'rgba(102,126,234,0.35)' : 'rgba(102,126,234,0.30)';
        ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ['hi', 'lo'].forEach(edge => {
            ctx.beginPath();
            forecastPts.forEach((f, i) => {
                const x = colX(N_CTX + 1 + i), y = scaleY(f[edge]);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
        ctx.setLineDash([]);
    }

    if (contextDays.length > 0) {
        ctx.strokeStyle = C.barNormal; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        ctx.beginPath();
        contextDays.forEach((d, i) => {
            const x = colX(i), y = scaleY(d.total);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        if (todayDay) ctx.lineTo(colX(N_CTX), scaleY(todayDay.total));
        ctx.stroke();
    }

    if (forecastPts.length > 0) {
        const anchorY = todayDay ? scaleY(todayDay.total) : scaleY(model ? model.L : 0);
        ctx.strokeStyle = '#667eea'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(colX(N_CTX), anchorY);
        forecastPts.forEach((f, i) => ctx.lineTo(colX(N_CTX + 1 + i), scaleY(f.point)));
        ctx.stroke();
    }

    contextDays.forEach((d, i) => {
        ctx.beginPath(); ctx.arc(colX(i), scaleY(d.total), 3, 0, Math.PI * 2);
        ctx.fillStyle = C.barNormal; ctx.fill();
    });

    if (todayDay) {
        const x = colX(N_CTX), y = scaleY(todayDay.total);
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = '#667eea'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = C.dotCenter; ctx.fill();
    }

    forecastPts.forEach((f, i) => {
        const x = colX(N_CTX + 1 + i), y = scaleY(f.point);
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#667eea'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fillStyle = C.dotCenter; ctx.fill();
    });

    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    ctx.textBaseline = 'top';
    contextDays.forEach((d, i) => {
        if (i % 7 !== 0) return;
        ctx.fillStyle = C.dateLabel; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(fmt(d.date), colX(i), PAD_T + chartH + 5);
    });
    ctx.fillStyle = C.todayLabel; ctx.font = '600 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Today', colX(N_CTX), PAD_T + chartH + 5);
    const showEvery = DAY_W < 28 ? 2 : 1;
    forecastPts.forEach((f, i) => {
        if (i % showEvery !== 0 && i !== N_FCST - 1) return;
        ctx.fillStyle = C.dateLabel; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(fmt(f.date), colX(N_CTX + 1 + i), PAD_T + chartH + 5);
    });
}

// --- Source breakdown histogram ---

function toTitleCase(str) { return str.replace(/\b\w/g, c => c.toUpperCase()); }

function formatMgLabel(mg) {
    if (mg >= 1e6) return (mg / 1e6) + 'kg';
    if (mg >= 1e3) return (mg / 1e3) + 'g';
    return mg + 'mg';
}

function formatMgValue(mg) {
    if (mg >= 1e6) { const v = mg / 1e6; return (Number.isInteger(v) ? v : v.toFixed(1)) + 'kg'; }
    if (mg >= 1e3) { const v = mg / 1e3; return (Number.isInteger(v) ? v : v.toFixed(1)) + 'g'; }
    return Math.round(mg) + 'mg';
}

export function drawSourceBreakdown() {
    const canvas = document.getElementById('source-breakdown-chart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssWidth = wrap.clientWidth;
    const cssHeight = wrap.clientHeight;
    if (cssWidth < 10 || cssHeight < 10) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssWidth + 'px'; canvas.style.height = cssHeight + 'px';
    canvas.width = cssWidth * dpr; canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const entries = getEntries();
    const totalsMap = {};
    entries.forEach(e => {
        const raw = (e.source || 'Unknown').trim();
        const key = raw.toLowerCase() || 'unknown';
        const display = key === 'unknown' ? 'Unknown' : toTitleCase(raw.trim());
        totalsMap[display] = (totalsMap[display] || 0) + e.amount;
    });
    const bars = Object.entries(totalsMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    const C = getChartColors();

    if (bars.length === 0) {
        ctx.fillStyle = C.yLabel; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('No entries yet', cssWidth / 2, cssHeight / 2);
        return;
    }

    const padLeft = 52, padRight = 16, padTop = 16, padBottom = 54;
    const chartW = cssWidth - padLeft - padRight;
    const chartH = cssHeight - padTop - padBottom;
    const maxVal = bars[0].total;
    const axisMax = Math.pow(10, Math.ceil(Math.log10(Math.max(maxVal, 10))));
    const sqrtMax = Math.sqrt(axisMax);
    const scaleY = val => padTop + chartH - (Math.sqrt(Math.max(val, 0)) / sqrtMax) * chartH;

    for (let exp = 1; Math.pow(10, exp) <= axisMax; exp++) {
        const val = Math.pow(10, exp);
        const y = scaleY(val);
        ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + chartW, y); ctx.stroke();
        ctx.fillStyle = C.yLabel; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(formatMgLabel(val), padLeft - 6, y + 3.5);
    }

    const gap = chartW / bars.length;
    const barW = Math.min(gap * 0.55, 56);
    bars.forEach((bar, i) => {
        const cx = padLeft + i * gap + gap / 2;
        const topY = scaleY(bar.total);
        const barH = (padTop + chartH) - topY;
        ctx.fillStyle = '#667eea';
        ctx.beginPath(); ctx.roundRect(cx - barW / 2, topY, barW, Math.max(barH, 2), 3); ctx.fill();
        ctx.fillStyle = C.barLabelNormal; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(formatMgValue(bar.total), cx, topY - 4);
        ctx.save();
        ctx.translate(cx, padTop + chartH + 8);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right'; ctx.fillStyle = C.dateLabel; ctx.font = '11px sans-serif';
        ctx.fillText(bar.name, 0, 0);
        ctx.restore();
    });
}

// --- Time-of-day weighted KDE ---

export function drawTimeOfDay() {
    const canvas = document.getElementById('timeofday-chart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssWidth = wrap.clientWidth;
    const cssHeight = wrap.clientHeight;
    if (cssWidth < 10 || cssHeight < 10) return;

    const entries = getEntries();
    const C = getChartColors();
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssWidth + 'px'; canvas.style.height = cssHeight + 'px';
    canvas.width = cssWidth * dpr; canvas.height = cssHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (entries.length === 0) {
        ctx.fillStyle = C.yLabel; ctx.font = '13px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('No entries yet', cssWidth / 2, cssHeight / 2);
        return;
    }

    const points = entries.map(e => { const d = new Date(e.timestamp); return { t: d.getHours() + d.getMinutes() / 60, w: e.amount }; });
    const totalWeight = points.reduce((s, p) => s + p.w, 0);
    const n = points.length;
    const mean = points.reduce((s, p) => s + p.t * p.w, 0) / totalWeight;
    const variance = points.reduce((s, p) => s + p.w * (p.t - mean) ** 2, 0) / totalWeight;
    const sigma = Math.sqrt(variance);
    const h = Math.min(Math.max(1.06 * sigma * Math.pow(n, -0.2), 0.4), 2.5);

    const N_EVAL = 360;
    const density = new Float64Array(N_EVAL);
    const gaussian = u => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
    for (let i = 0; i < N_EVAL; i++) {
        const x = (i / (N_EVAL - 1)) * 24;
        let d = 0;
        points.forEach(p => { for (const t of [p.t, p.t - 24, p.t + 24]) d += p.w * gaussian((x - t) / h); });
        density[i] = d / (totalWeight * h);
    }
    const maxDensity = Math.max(...density);

    const PAD_LEFT = 12, PAD_RIGHT = 12, PAD_TOP = 12, PAD_BOTTOM = 28;
    const chartW = cssWidth - PAD_LEFT - PAD_RIGHT;
    const chartH = cssHeight - PAD_TOP - PAD_BOTTOM;
    const xToCanvas = t => PAD_LEFT + (t / 24) * chartW;
    const yToCanvas = d => PAD_TOP + chartH - (d / maxDensity) * chartH;

    const dark = isDarkMode();
    ctx.beginPath();
    ctx.moveTo(xToCanvas(0), yToCanvas(density[0]));
    for (let i = 1; i < N_EVAL; i++) ctx.lineTo(xToCanvas((i / (N_EVAL - 1)) * 24), yToCanvas(density[i]));
    ctx.lineTo(xToCanvas(24), PAD_TOP + chartH);
    ctx.lineTo(xToCanvas(0), PAD_TOP + chartH);
    ctx.closePath();
    ctx.fillStyle = dark ? 'rgba(102,126,234,0.25)' : 'rgba(102,126,234,0.18)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xToCanvas(0), yToCanvas(density[0]));
    for (let i = 1; i < N_EVAL; i++) ctx.lineTo(xToCanvas((i / (N_EVAL - 1)) * 24), yToCanvas(density[i]));
    ctx.strokeStyle = '#667eea'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_LEFT, PAD_TOP + chartH); ctx.lineTo(PAD_LEFT + chartW, PAD_TOP + chartH); ctx.stroke();

    const hourLabels = [[0,'12am'],[3,'3am'],[6,'6am'],[9,'9am'],[12,'12pm'],[15,'3pm'],[18,'6pm'],[21,'9pm'],[24,'12am']];
    ctx.fillStyle = C.dateLabel; ctx.font = '10px sans-serif'; ctx.textBaseline = 'top';
    hourLabels.forEach(([hr, label]) => {
        const x = xToCanvas(hr);
        ctx.textAlign = hr === 0 ? 'left' : hr === 24 ? 'right' : 'center';
        ctx.fillText(label, x, PAD_TOP + chartH + 6);
    });
    hourLabels.forEach(([hr]) => {
        const x = xToCanvas(hr);
        ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, PAD_TOP + chartH); ctx.lineTo(x, PAD_TOP + chartH + 4); ctx.stroke();
    });
}

// --- Bedtime caffeine chart ---

const BEDTIME_HOUR = 23;

// Gaussian-weighted moving average (LOESS-style trend).
// Returns { smoothed: number[], sd: number[] } — weighted mean and weighted SD at each point.
function gaussianSmooth(values, bandwidth) {
    const smoothed = values.map((_, i) => {
        let wSum = 0, vSum = 0;
        values.forEach((v, j) => {
            const d = (i - j) / bandwidth;
            const w = Math.exp(-(d * d));
            wSum += w; vSum += w * v;
        });
        return vSum / wSum;
    });
    const sd = smoothed.map((s, i) => {
        let wSum = 0, vSum = 0;
        values.forEach((v, j) => {
            const d = (i - j) / bandwidth;
            const w = Math.exp(-(d * d));
            const diff = v - s;
            wSum += w; vSum += w * (diff * diff);
        });
        return Math.sqrt(vSum / wSum);
    });
    return { smoothed, sd };
}

export function drawBedtimeCaffeine() {
    const canvas = document.getElementById('bedtime-chart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssWidth = wrap.clientWidth;
    const cssHeight = wrap.clientHeight;
    if (cssWidth < 10 || cssHeight < 10) return;

    const entries = getEntries();
    const allDays = buildHistoryDays();
    if (allDays.length === 0) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = cssWidth * dpr; canvas.height = cssHeight * dpr;
        canvas.style.width = cssWidth + 'px'; canvas.style.height = cssHeight + 'px';
        ctx.scale(dpr, dpr);
        ctx.fillStyle = getChartColors().yLabel; ctx.font = '13px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('No entries yet', cssWidth / 2, cssHeight / 2);
        return;
    }

    const points = allDays.map(({ date }) => {
        const bedtime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), BEDTIME_HOUR, 0, 0);
        return { date, value: getCaffeineAtTime(entries, bedtime) };
    });

    const n = points.length;

    // Adaptive display mode based on history length
    // short: ≤60 days — full dots + line, no trend
    // medium: ≤180 days — smaller dots, thinner line, trend overlay
    // long: >180 days — ghost line (no dots), trend dominant + SD band
    const mode = n <= 60 ? 'short' : n <= 180 ? 'medium' : 'long';
    const showTrend = bedtimeTrendEnabled && n >= 14;
    const rawOpacity = showTrend ? (mode === 'long' ? 0.25 : mode === 'medium' ? 0.4 : 0.35) : 1;
    const rawLineWidth = showTrend ? (mode === 'long' ? 1 : mode === 'medium' ? 1.5 : 2) : 2;
    const dotRadius = showTrend ? (mode === 'short' ? 3.5 : mode === 'medium' ? 2 : 0) : 3.5;
    const dotCenterRadius = showTrend && mode !== 'short' ? 1.2 : 2;
    const bandwidth = Math.max(3, n * 0.1);

    const PAD_LEFT = 50, PAD_RIGHT = 16, PAD_TOP = 16, PAD_BOTTOM = 50;
    const chartH = cssHeight - PAD_TOP - PAD_BOTTOM;
    const DAY_W = Math.max(20, Math.floor((cssWidth - PAD_LEFT - PAD_RIGHT) / points.length));
    const cssW = Math.max(cssWidth, PAD_LEFT + points.length * DAY_W + PAD_RIGHT);

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssHeight + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssHeight);

    const rawValues = points.map(p => p.value);
    const trend = showTrend ? gaussianSmooth(rawValues, bandwidth) : null;

    // Y-axis range: include trend ± SD so nothing clips
    const allDisplayVals = [...rawValues];
    if (trend) {
        trend.smoothed.forEach((s, i) => { allDisplayVals.push(s + trend.sd[i]); });
    }
    const maxVal = Math.max(...allDisplayVals, 50);
    const scaleY = val => PAD_TOP + chartH - (val / maxVal) * chartH;
    const ptX = i => PAD_LEFT + i * DAY_W + DAY_W / 2;
    const C = getChartColors();

    // Gridlines + y labels
    [0, Math.round(maxVal / 2), Math.round(maxVal)].forEach(v => {
        const y = scaleY(v);
        ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_LEFT, y); ctx.lineTo(cssW - PAD_RIGHT, y); ctx.stroke();
        ctx.fillStyle = C.yLabel; ctx.font = '10px sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(v) + 'mg', PAD_LEFT - 5, y);
    });

    // Month boundaries
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    points.forEach((p, i) => {
        if (i > 0 && p.date.getDate() === 1) {
            const x = PAD_LEFT + i * DAY_W;
            ctx.strokeStyle = C.boundaryLine; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.moveTo(x, PAD_TOP); ctx.lineTo(x, PAD_TOP + chartH); ctx.stroke();
            ctx.setLineDash([]);
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#667eea'; ctx.font = '600 11px sans-serif';
            ctx.fillText(MONTHS[p.date.getMonth()], x, PAD_TOP + chartH + 28);
            ctx.fillStyle = C.monthYear; ctx.font = '10px sans-serif';
            ctx.fillText(p.date.getFullYear(), x, PAD_TOP + chartH + 40);
        }
    });

    // SD confidence band (drawn first, behind everything)
    if (trend && mode === 'long') {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#764ba2';
        ctx.beginPath();
        points.forEach((_, i) => {
            const x = ptX(i), y = scaleY(trend.smoothed[i] + trend.sd[i]);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        for (let i = points.length - 1; i >= 0; i--) {
            const x = ptX(i), y = scaleY(Math.max(0, trend.smoothed[i] - trend.sd[i]));
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // Raw data line
    if (points.length > 1) {
        ctx.save();
        ctx.globalAlpha = rawOpacity;
        ctx.strokeStyle = '#764ba2'; ctx.lineWidth = rawLineWidth; ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((p, i) => { const x = ptX(i), y = scaleY(p.value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
        ctx.restore();
    }

    // Raw data dots
    if (dotRadius > 0) {
        ctx.save();
        ctx.globalAlpha = rawOpacity;
        points.forEach((p, i) => {
            const x = ptX(i), y = scaleY(p.value);
            const isToday = i === points.length - 1;
            const r = isToday ? dotRadius + 1.5 : dotRadius;
            const rc = isToday ? dotCenterRadius + 1 : dotCenterRadius;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#764ba2'; ctx.fill();
            ctx.beginPath(); ctx.arc(x, y, rc, 0, Math.PI * 2); ctx.fillStyle = C.dotCenter; ctx.fill();
        });
        ctx.restore();
    }

    // Trend line (on top, full opacity)
    if (trend) {
        ctx.save();
        ctx.strokeStyle = '#764ba2'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.beginPath();
        trend.smoothed.forEach((s, i) => { const x = ptX(i), y = scaleY(s); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
        ctx.restore();
    }

    // Today dot always drawn on top at full opacity
    const lastI = points.length - 1;
    const todayX = ptX(lastI), todayY = scaleY(points[lastI].value);
    ctx.beginPath(); ctx.arc(todayX, todayY, 5, 0, Math.PI * 2); ctx.fillStyle = '#764ba2'; ctx.fill();
    ctx.beginPath(); ctx.arc(todayX, todayY, 3, 0, Math.PI * 2); ctx.fillStyle = C.dotCenter; ctx.fill();

    // X-axis tick labels
    const tickInterval = n <= 21 ? 1 : n <= 60 ? 7 : n <= 180 ? 14 : 28;
    const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    points.forEach((p, i) => {
        const isToday = i === points.length - 1;
        if (!isToday && i % tickInterval !== 0) return;
        const x = ptX(i);
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = isToday ? C.todayLabel : C.dateLabel;
        ctx.font = `${isToday ? 600 : 400} 10px sans-serif`;
        ctx.fillText(`${String(p.date.getDate()).padStart(2,'0')}/${String(p.date.getMonth()+1).padStart(2,'0')}`, x, PAD_TOP + chartH + 4);
        ctx.fillStyle = isToday ? C.todayLabel : C.weekdayLabel;
        ctx.font = `${isToday ? 600 : 400} 9px sans-serif`;
        ctx.fillText(isToday ? 'Today' : WEEKDAYS[p.date.getDay()], x, PAD_TOP + chartH + 15);
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
    const dark = isDarkMode();

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

// --- Live episode chart ---

const EPISODE_THRESHOLD_MG = 5;
const EPISODE_STEP_MS      = 5 * 60 * 1000;
const EPISODE_MAX_LOOKBACK = 48 * 3600 * 1000;
const EPISODE_MAX_AHEAD    = 24 * 3600 * 1000;

let episodeCurve   = null;
let episodeAnimFrame = null;
let episodeCanvasW = 0;
let episodeCanvasH = 0;

export function isEpisodeAnimating() { return !!episodeAnimFrame; }

export function buildEpisodeCurve() {
    const entries    = getEntries();
    const halfLifeMs = getHalfLife() * 3600 * 1000;
    const nowMs      = Date.now();
    const THRESH     = EPISODE_THRESHOLD_MG;
    const currentLevel = computeLevelAt(nowMs, entries, halfLifeMs);
    let episodeStartMs, episodeEndMs, hadHistory;

    if (currentLevel >= THRESH) {
        hadHistory = true;
        episodeStartMs = nowMs - EPISODE_MAX_LOOKBACK;
        for (let t = nowMs - EPISODE_STEP_MS; t >= nowMs - EPISODE_MAX_LOOKBACK; t -= EPISODE_STEP_MS) {
            if (computeLevelAt(t, entries, halfLifeMs) < THRESH) { episodeStartMs = t; break; }
        }
        episodeEndMs = nowMs + EPISODE_MAX_AHEAD;
        for (let t = nowMs + EPISODE_STEP_MS; t <= nowMs + EPISODE_MAX_AHEAD; t += EPISODE_STEP_MS) {
            if (computeLevelAt(t, entries, halfLifeMs) < THRESH) { episodeEndMs = t; break; }
        }
    } else {
        let lastAboveMs = null;
        for (let t = nowMs - EPISODE_STEP_MS; t >= nowMs - EPISODE_MAX_LOOKBACK; t -= EPISODE_STEP_MS) {
            if (computeLevelAt(t, entries, halfLifeMs) >= THRESH) { lastAboveMs = t; break; }
        }
        if (!lastAboveMs) {
            hadHistory = false;
            episodeStartMs = nowMs - 12 * 3600 * 1000;
            episodeEndMs   = nowMs;
        } else {
            hadHistory = true;
            episodeStartMs = nowMs - EPISODE_MAX_LOOKBACK;
            for (let t = lastAboveMs - EPISODE_STEP_MS; t >= nowMs - EPISODE_MAX_LOOKBACK; t -= EPISODE_STEP_MS) {
                if (computeLevelAt(t, entries, halfLifeMs) < THRESH) { episodeStartMs = t; break; }
            }
            episodeEndMs = nowMs;
            for (let t = lastAboveMs + EPISODE_STEP_MS; t <= nowMs; t += EPISODE_STEP_MS) {
                if (computeLevelAt(t, entries, halfLifeMs) < THRESH) { episodeEndMs = t; break; }
            }
        }
    }

    const PAD = 30 * 60 * 1000;
    episodeStartMs = Math.max(episodeStartMs - PAD, nowMs - EPISODE_MAX_LOOKBACK);
    episodeEndMs   = Math.min(episodeEndMs   + PAD, nowMs + EPISODE_MAX_AHEAD);

    const points = [];
    for (let t = episodeStartMs; t <= episodeEndMs; t += EPISODE_STEP_MS) {
        points.push({ t, mg: computeLevelAt(t, entries, halfLifeMs) });
    }
    episodeCurve = { points, episodeStartMs, episodeEndMs, currentLevel, builtAtMs: nowMs, hadHistory };
    updateEpisodeSubtitle();
}

function fmtDuration(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function updateEpisodeSubtitle() {
    const sub   = document.getElementById('episode-subtitle');
    const level = document.getElementById('episode-level');
    if (!sub || !episodeCurve) return;
    const { episodeStartMs, episodeEndMs, currentLevel } = episodeCurve;
    const nowMs = Date.now();
    if (level) level.textContent = currentLevel.toFixed(1) + ' mg now';
    if (currentLevel >= EPISODE_THRESHOLD_MG) {
        sub.textContent = `Episode started ${fmtDuration(nowMs - episodeStartMs)} ago · clears in ~${fmtDuration(episodeEndMs - nowMs)}`;
    } else if (episodeCurve.hadHistory) {
        const clearTime = new Date(episodeCurve.episodeEndMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        sub.textContent = `Clear since ${clearTime}`;
    } else {
        sub.textContent = 'No active episode';
    }
}

function drawEpisodeFrame() {
    const canvas = document.getElementById('episode-chart');
    if (!canvas || !episodeCurve) return;
    const wrap = canvas.parentElement;
    const cssW = wrap.clientWidth;
    const cssH = wrap.clientHeight;
    if (cssW < 10 || cssH < 10) return;

    const dpr = window.devicePixelRatio || 1;
    if (episodeCanvasW !== cssW || episodeCanvasH !== cssH) {
        canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
        canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
        episodeCanvasW = cssW; episodeCanvasH = cssH;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const C = getChartColors();
    const dark = isDarkMode();
    const nowMs = Date.now();
    const { points, episodeStartMs, episodeEndMs } = episodeCurve;

    const PAD_L = 60, PAD_R = 28, PAD_T = 20, PAD_B = 44;
    const chartW = cssW - PAD_L - PAD_R;
    const chartH = cssH - PAD_T - PAD_B;
    const tMin = episodeStartMs, tMax = episodeEndMs;
    const maxMg = Math.max(...points.map(p => p.mg), 10) * 1.15;
    const sx = t  => PAD_L + (t - tMin) / (tMax - tMin) * chartW;
    const sy = mg => PAD_T + chartH - (Math.max(mg, 0) / maxMg) * chartH;

    const yStep = maxMg > 300 ? 100 : maxMg > 100 ? 50 : 25;
    for (let v = 0; v <= maxMg; v += yStep) {
        const y = sy(v);
        if (y < PAD_T) break;
        ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + chartW, y); ctx.stroke();
        ctx.fillStyle = C.yLabel; ctx.font = '12px sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(v + 'mg', PAD_L - 7, y);
    }

    const threshY = sy(EPISODE_THRESHOLD_MG);
    ctx.strokeStyle = dark ? 'rgba(231,76,60,0.35)' : 'rgba(231,76,60,0.4)';
    ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD_L, threshY); ctx.lineTo(PAD_L + chartW, threshY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = dark ? 'rgba(231,76,60,0.7)' : 'rgba(231,76,60,0.75)';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('5mg', PAD_L + 4, threshY - 3);

    const totalMs = tMax - tMin;
    const tickStep = totalMs > 36 * 3600000 ? 6 * 3600000 : totalMs > 18 * 3600000 ? 3 * 3600000 : 2 * 3600000;
    ctx.fillStyle = C.dateLabel; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const firstTick = Math.ceil(tMin / tickStep) * tickStep;
    for (let t = firstTick; t <= tMax; t += tickStep) {
        const x = sx(t);
        const d = new Date(t);
        const hh = String(d.getHours()).padStart(2,'0');
        const mm = String(d.getMinutes()).padStart(2,'0');
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        const label = isToday ? `${hh}:${mm}` : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${hh}:${mm}`;
        if (Math.abs(x - sx(nowMs)) < 30) continue;
        ctx.fillStyle = C.dateLabel;
        ctx.fillText(label, x, PAD_T + chartH + 5);
        ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + chartH); ctx.stroke();
    }

    let nowMg = 0;
    for (let i = 0; i < points.length - 1; i++) {
        if (points[i].t <= nowMs && points[i + 1].t > nowMs) {
            const frac = (nowMs - points[i].t) / (points[i + 1].t - points[i].t);
            nowMg = points[i].mg + frac * (points[i + 1].mg - points[i].mg);
            break;
        }
    }
    const nowX = sx(nowMs);
    const nowY = sy(nowMg);

    ctx.strokeStyle = dark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.25)';
    ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(nowX, PAD_T); ctx.lineTo(nowX, PAD_T + chartH); ctx.stroke();
    ctx.setLineDash([]);

    const pastPts = points.filter(p => p.t <= nowMs);
    if (pastPts.length > 1) {
        ctx.strokeStyle = '#667eea'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.beginPath();
        pastPts.forEach((p, i) => i === 0 ? ctx.moveTo(sx(p.t), sy(p.mg)) : ctx.lineTo(sx(p.t), sy(p.mg)));
        ctx.lineTo(nowX, nowY);
        ctx.stroke();
    }

    const futurePts = points.filter(p => p.t >= nowMs);
    if (futurePts.length > 1) {
        ctx.strokeStyle = dark ? 'rgba(102,126,234,0.35)' : 'rgba(102,126,234,0.4)';
        ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(nowX, nowY);
        futurePts.forEach(p => ctx.lineTo(sx(p.t), sy(p.mg)));
        ctx.stroke();
        ctx.setLineDash([]);
    }

    const pulse = 1 + 0.2 * Math.sin(Date.now() / 600);
    ctx.beginPath(); ctx.arc(nowX, nowY, 7 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = dark ? 'rgba(102,126,234,0.2)' : 'rgba(102,126,234,0.15)'; ctx.fill();
    ctx.beginPath(); ctx.arc(nowX, nowY, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#667eea'; ctx.fill();
    ctx.beginPath(); ctx.arc(nowX, nowY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isDarkMode() ? '#1a1b2e' : 'white'; ctx.fill();

    ctx.fillStyle = C.todayLabel; ctx.font = '600 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Now', nowX, PAD_T + chartH + 6);
}

export function startEpisodeAnimation() {
    if (episodeAnimFrame) return;
    function loop() {
        drawEpisodeFrame();
        episodeAnimFrame = requestAnimationFrame(loop);
    }
    episodeAnimFrame = requestAnimationFrame(loop);
}

export function stopEpisodeAnimation() {
    if (episodeAnimFrame) {
        cancelAnimationFrame(episodeAnimFrame);
        episodeAnimFrame = null;
    }
}
