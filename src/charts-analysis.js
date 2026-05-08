import { getCaffeineAtTime } from './calculations.js';
import { getEntries } from './storage.js';
import { isDarkMode, getChartColors } from './charts-shared.js';
import { buildHistoryDays } from './charts-main.js';

// --- Analysis chart state ---

let bedtimeTrendEnabled = false;
let sourceTop10Enabled = false;
let heatmapState = null;

export function getBedtimeTrendEnabled() { return bedtimeTrendEnabled; }
export function setBedtimeTrendEnabled(v) { bedtimeTrendEnabled = v; }
export function getSourceTop10Enabled() { return sourceTop10Enabled; }
export function setSourceTop10Enabled(v) { sourceTop10Enabled = v; }

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
    const allBars = Object.entries(totalsMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    const bars = sourceTop10Enabled ? allBars.slice(0, 10) : allBars;
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

    const allDisplayVals = [...rawValues];
    if (trend) trend.smoothed.forEach((s, i) => { allDisplayVals.push(s + trend.sd[i]); });
    const maxVal = Math.max(...allDisplayVals, 50);
    const scaleY = val => PAD_TOP + chartH - (val / maxVal) * chartH;
    const ptX = i => PAD_LEFT + i * DAY_W + DAY_W / 2;
    const C = getChartColors();

    const gridSteps = [0, Math.round(maxVal / 2), Math.round(maxVal)];
    gridSteps.forEach(v => {
        const y = scaleY(v);
        ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_LEFT, y); ctx.lineTo(cssW - PAD_RIGHT, y); ctx.stroke();
    });

    const yAxis = document.getElementById('bedtime-yaxis');
    if (yAxis) {
        yAxis.style.width = PAD_LEFT + 'px';
        yAxis.style.height = cssHeight + 'px';
        yAxis.width = Math.round(PAD_LEFT * dpr);
        yAxis.height = Math.round(cssHeight * dpr);
        const yCtx = yAxis.getContext('2d');
        yCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        yCtx.clearRect(0, 0, PAD_LEFT, cssHeight);
        gridSteps.forEach(v => {
            const y = scaleY(v);
            yCtx.strokeStyle = C.gridLine; yCtx.lineWidth = 1;
            yCtx.beginPath(); yCtx.moveTo(0, y); yCtx.lineTo(PAD_LEFT, y); yCtx.stroke();
            yCtx.fillStyle = C.yLabel; yCtx.font = '10px sans-serif';
            yCtx.textAlign = 'right'; yCtx.textBaseline = 'middle';
            yCtx.fillText(Math.round(v) + 'mg', PAD_LEFT - 5, y);
        });
    }

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

    if (points.length > 1) {
        ctx.save();
        ctx.globalAlpha = rawOpacity;
        ctx.strokeStyle = '#764ba2'; ctx.lineWidth = rawLineWidth; ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((p, i) => { const x = ptX(i), y = scaleY(p.value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
        ctx.restore();
    }

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

    if (trend) {
        ctx.save();
        ctx.strokeStyle = '#764ba2'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.beginPath();
        trend.smoothed.forEach((s, i) => { const x = ptX(i), y = scaleY(s); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
        ctx.restore();
    }

    const lastI = points.length - 1;
    const todayX = ptX(lastI), todayY = scaleY(points[lastI].value);
    ctx.beginPath(); ctx.arc(todayX, todayY, 5, 0, Math.PI * 2); ctx.fillStyle = '#764ba2'; ctx.fill();
    ctx.beginPath(); ctx.arc(todayX, todayY, 3, 0, Math.PI * 2); ctx.fillStyle = C.dotCenter; ctx.fill();

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

    const container = canvas.parentElement;
    if (container) container.scrollLeft = container.scrollWidth;
}

// --- Calendar heatmap ---

function dateKey(d) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function drawHeatmap() {
    const canvas = document.getElementById('heatmap-chart');
    if (!canvas) return;
    const container = canvas.parentElement;

    const allDays = buildHistoryDays();
    const C = getChartColors();
    const dark = isDarkMode();
    const dpr = window.devicePixelRatio || 1;

    const CELL = 13, GAP = 2, STEP = CELL + GAP;
    const PAD_LEFT = 34, PAD_TOP = 22, PAD_RIGHT = 10, PAD_BOTTOM = 4;
    const cssH = PAD_TOP + 7 * STEP + PAD_BOTTOM;

    if (allDays.length === 0) {
        const cssW = container.clientWidth || 300;
        canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
        canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = C.yLabel; ctx.font = '13px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('No entries yet', cssW / 2, cssH / 2);
        return;
    }

    const dayMap = new Map();
    allDays.forEach(({ date, total }) => dayMap.set(dateKey(date), total));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDay = new Date(allDays[0].date);
    firstDay.setHours(0, 0, 0, 0);
    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - (firstDay.getDay() + 6) % 7);

    const gridEnd = new Date(today);
    gridEnd.setDate(gridEnd.getDate() + (6 - (today.getDay() + 6) % 7));

    const nWeeks = Math.ceil((Math.round((gridEnd - gridStart) / 86400000) + 1) / 7);
    const cssW = Math.max(container.clientWidth || 300, PAD_LEFT + nWeeks * STEP + PAD_RIGHT);
    const xOffset = Math.max(0, cssW - PAD_LEFT - PAD_RIGHT - nWeeks * STEP);

    const nonZero = allDays.filter(d => d.total > 0).map(d => d.total).sort((a, b) => a - b);
    const getQ = f => nonZero[Math.max(0, Math.floor(nonZero.length * f) - 1)] || 1;
    const [q1, q2, q3] = [getQ(0.25), getQ(0.5), getQ(0.75)];
    function levelOf(total) {
        if (!total) return 0;
        if (total <= q1) return 1;
        if (total <= q2) return 2;
        if (total <= q3) return 3;
        return 4;
    }
    const COLORS = dark
        ? ['rgba(118,75,162,0.12)', 'rgba(118,75,162,0.36)', 'rgba(118,75,162,0.57)', 'rgba(118,75,162,0.78)', '#9b6fd0']
        : ['#eeeaf8', '#c9b8ed', '#a07fd4', '#7a52bc', '#5a2d9c'];

    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let prevMonth = -1, lastMonthW = -Infinity;

    for (let w = 0; w < nWeeks; w++) {
        const weekDate = new Date(gridStart);
        weekDate.setDate(weekDate.getDate() + w * 7);

        const month = weekDate.getMonth();
        if (month !== prevMonth && w - lastMonthW >= 3) {
            ctx.fillStyle = dark ? '#9a9bb8' : '#888';
            ctx.font = '600 10px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(MONTHS[month], PAD_LEFT + xOffset + w * STEP, PAD_TOP - 6);
            prevMonth = month;
            lastMonthW = w;
        }

        for (let d = 0; d < 7; d++) {
            const date = new Date(gridStart);
            date.setDate(date.getDate() + w * 7 + d);
            if (date > today) continue;

            const total = dayMap.get(dateKey(date)) || 0;
            const x = PAD_LEFT + xOffset + w * STEP;
            const y = PAD_TOP + d * STEP;

            ctx.fillStyle = COLORS[levelOf(total)];
            ctx.beginPath();
            ctx.roundRect(x, y, CELL, CELL, 2);
            ctx.fill();

            if (date.getTime() === today.getTime()) {
                ctx.strokeStyle = dark ? '#b08cd8' : '#764ba2';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(x, y, CELL, CELL, 2);
                ctx.stroke();
            }
        }
    }

    const yAxis = document.getElementById('heatmap-yaxis');
    if (yAxis) {
        yAxis.style.width = PAD_LEFT + 'px';
        yAxis.style.height = cssH + 'px';
        yAxis.width = Math.round(PAD_LEFT * dpr);
        yAxis.height = Math.round(cssH * dpr);
        const yCtx = yAxis.getContext('2d');
        yCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        yCtx.clearRect(0, 0, PAD_LEFT, cssH);
        [['Mon', 0], ['Wed', 2], ['Fri', 4], ['Sun', 6]].forEach(([label, d]) => {
            yCtx.fillStyle = dark ? '#9a9bb8' : '#888';
            yCtx.font = '9px sans-serif';
            yCtx.textAlign = 'right';
            yCtx.textBaseline = 'middle';
            yCtx.fillText(label, PAD_LEFT - 4, PAD_TOP + d * STEP + CELL / 2);
        });
    }

    COLORS.forEach((c, i) => {
        const swatch = document.getElementById(`hl-${i}`);
        if (swatch) swatch.style.background = c;
    });

    heatmapState = { gridStart, nWeeks, dayMap, today, xOffset, PAD_LEFT, PAD_TOP, STEP, CELL };
    container.scrollLeft = container.scrollWidth;
}

export function initHeatmapTooltip() {
    const canvas = document.getElementById('heatmap-chart');
    if (!canvas) return;
    const container = canvas.parentElement;

    const tip = document.createElement('div');
    tip.className = 'heatmap-tooltip';
    document.body.appendChild(tip);

    container.addEventListener('mousemove', e => {
        if (!heatmapState) { tip.style.display = 'none'; return; }
        const { gridStart, nWeeks, dayMap, today, xOffset, PAD_LEFT, PAD_TOP, STEP, CELL } = heatmapState;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const gx = x - PAD_LEFT - xOffset;
        const gy = y - PAD_TOP;

        if (gx < 0 || gy < 0) { tip.style.display = 'none'; return; }

        const col = Math.floor(gx / STEP);
        const row = Math.floor(gy / STEP);
        if (col >= nWeeks || row >= 7 || gx % STEP > CELL || gy % STEP > CELL) {
            tip.style.display = 'none'; return;
        }

        const date = new Date(gridStart);
        date.setDate(date.getDate() + col * 7 + row);
        if (date > today) { tip.style.display = 'none'; return; }

        const total = dayMap.get(dateKey(date)) || 0;
        const label = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        tip.textContent = total > 0 ? `${label} · ${Math.round(total)}mg` : `${label} · no data`;
        tip.style.display = 'block';

        const tx = e.clientX + 14;
        const ty = e.clientY - 38;
        tip.style.left = Math.min(tx, window.innerWidth - tip.offsetWidth - 8) + 'px';
        tip.style.top = Math.max(8, ty) + 'px';
    });

    container.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
}
