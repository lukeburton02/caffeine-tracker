// Caffeine Tracker - Main Application Logic

const DEFAULT_HALF_LIFE_HOURS = 5;
const STORAGE_KEY = 'caffeine_entries';
const HALFLIFE_KEY = 'caffeine_halflife';
const HIGH_THRESHOLD = 200; // mg — warn once when crossing above this

let prevCaffeineLevel = null;
let highWarningTimer = null;
let historyMode = 'all';      // 'all' | 'window'
let historyWindowOffset = 0;  // days before today for the window end (0 = today)

const THEME_KEY = 'caffeine_theme';

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

// --- 7-day forecast (triple exponential smoothing / Holt-Winters additive) ---

const TES_ALPHA  = 0.3; // level smoothing
const TES_BETA   = 0.1; // trend smoothing
const TES_GAMMA  = 0.2; // seasonal smoothing
const TES_PERIOD = 7;   // weekly seasonality

// Mon=0 ... Sun=6
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
    // Need at least 2 full seasons for seasonal initialisation
    if (values.length < TES_PERIOD * 2) return fitDES(values);

    const m = TES_PERIOD;
    const A1 = values.slice(0, m).reduce((a, b) => a + b, 0) / m;
    const A2 = values.slice(m, m * 2).reduce((a, b) => a + b, 0) / m;
    let L = A1;
    let T = (A2 - A1) / m;
    // Seasonal indices from first season, one per weekday
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

function drawForecast() {
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

    // Fit model on all completed days
    const model = fitTES(completedDays.map(d => d.total), completedDays.map(d => d.date));

    // Build 7-day forecast with 80% prediction intervals (±1.28 * RMSE * √h)
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

    // Context: last 14 completed days
    const contextDays = completedDays.slice(-14);

    const N_CTX  = contextDays.length;
    const N_FCST = forecastPts.length;
    const N_COLS = N_CTX + 1 + N_FCST; // +1 for today

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

    // Gridlines
    [0, Math.round(maxVal / 2), Math.round(maxVal)].forEach(v => {
        const y = scaleY(v);
        ctx.strokeStyle = C.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(PAD_L + chartW, y);
        ctx.stroke();
        ctx.fillStyle = C.yLabel;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(v + 'mg', PAD_L - 5, y);
    });

    // Vertical separator at today/forecast boundary
    const sepX = PAD_L + (N_CTX + 1) * DAY_W;
    ctx.strokeStyle = C.boundaryLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sepX, PAD_T);
    ctx.lineTo(sepX, PAD_T + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    // "Forecast →" label
    ctx.fillStyle = dark ? 'rgba(102,126,234,0.45)' : 'rgba(102,126,234,0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('forecast →', PAD_L + (N_CTX + 1) * DAY_W + (N_FCST * DAY_W) / 2, PAD_T + 2);

    // Prediction band (shaded area + dashed bounds)
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
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = dark ? 'rgba(102,126,234,0.35)' : 'rgba(102,126,234,0.30)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
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

    // History line (greyed)
    if (contextDays.length > 0) {
        ctx.strokeStyle = C.barNormal;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        contextDays.forEach((d, i) => {
            const x = colX(i), y = scaleY(d.total);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        if (todayDay) ctx.lineTo(colX(N_CTX), scaleY(todayDay.total));
        ctx.stroke();
    }

    // Forecast line (from today's anchor to each forecast point)
    if (forecastPts.length > 0) {
        const anchorY = todayDay ? scaleY(todayDay.total) : scaleY(model ? model.L : 0);
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(colX(N_CTX), anchorY);
        forecastPts.forEach((f, i) => ctx.lineTo(colX(N_CTX + 1 + i), scaleY(f.point)));
        ctx.stroke();
    }

    // History dots
    contextDays.forEach((d, i) => {
        ctx.beginPath();
        ctx.arc(colX(i), scaleY(d.total), 3, 0, Math.PI * 2);
        ctx.fillStyle = C.barNormal;
        ctx.fill();
    });

    // Today dot
    if (todayDay) {
        const x = colX(N_CTX), y = scaleY(todayDay.total);
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#667eea'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = C.dotCenter; ctx.fill();
    }

    // Forecast dots
    forecastPts.forEach((f, i) => {
        const x = colX(N_CTX + 1 + i), y = scaleY(f.point);
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#667eea'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = C.dotCenter; ctx.fill();
    });

    // X-axis labels
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    ctx.textBaseline = 'top';

    // History: show every 7 days
    contextDays.forEach((d, i) => {
        if (i % 7 !== 0) return;
        ctx.fillStyle = C.dateLabel;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fmt(d.date), colX(i), PAD_T + chartH + 5);
    });

    // Today
    ctx.fillStyle = C.todayLabel;
    ctx.font = '600 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Today', colX(N_CTX), PAD_T + chartH + 5);

    // Forecast dates: every other if columns are narrow
    const showEvery = DAY_W < 28 ? 2 : 1;
    forecastPts.forEach((f, i) => {
        if (i % showEvery !== 0 && i !== N_FCST - 1) return;
        ctx.fillStyle = C.dateLabel;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fmt(f.date), colX(N_CTX + 1 + i), PAD_T + chartH + 5);
    });
}

// --- Source breakdown histogram ---

function toTitleCase(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

function drawSourceBreakdown() {
    const canvas = document.getElementById('source-breakdown-chart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssWidth = wrap.clientWidth;
    const cssHeight = wrap.clientHeight;
    if (cssWidth < 10 || cssHeight < 10) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Aggregate totals by normalised source name
    const entries = getEntries();
    const totalsMap = {};
    entries.forEach(e => {
        const raw = (e.source || 'Unknown').trim();
        const key = raw.toLowerCase() || 'unknown';
        const display = key === 'unknown' ? 'Unknown' : toTitleCase(raw.trim());
        totalsMap[display] = (totalsMap[display] || 0) + e.amount;
    });

    const bars = Object.entries(totalsMap)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);

    const C = getChartColors();

    if (bars.length === 0) {
        ctx.fillStyle = C.yLabel;
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No entries yet', cssWidth / 2, cssHeight / 2);
        return;
    }

    const padLeft = 52, padRight = 16, padTop = 16, padBottom = 54;
    const chartW = cssWidth - padLeft - padRight;
    const chartH = cssHeight - padTop - padBottom;

    // Log₁₀ scale: axis runs from 1mg (log=0) to 10^maxLog
    const maxVal = bars[0].total;
    const maxLog = Math.ceil(Math.log10(Math.max(maxVal, 10)));
    const minLog = 0;

    function logY(val) {
        const lv = Math.log10(Math.max(val, 1));
        return padTop + chartH - (lv - minLog) / (maxLog - minLog) * chartH;
    }

    // Gridlines + y-axis labels at powers of 10
    for (let exp = 1; exp <= maxLog; exp++) {
        const y = logY(Math.pow(10, exp));
        ctx.strokeStyle = C.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + chartW, y);
        ctx.stroke();

        ctx.fillStyle = C.yLabel;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.pow(10, exp) + 'mg', padLeft - 6, y + 3.5);
    }

    // Bars
    const gap = chartW / bars.length;
    const barW = Math.min(gap * 0.55, 56);

    bars.forEach((bar, i) => {
        const cx = padLeft + i * gap + gap / 2;
        const topY = logY(bar.total);
        const barH = (padTop + chartH) - topY;

        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.roundRect(cx - barW / 2, topY, barW, Math.max(barH, 2), 3);
        ctx.fill();

        // Value label above bar
        ctx.fillStyle = C.barLabelNormal;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(bar.total) + 'mg', cx, topY - 4);

        // Source label rotated -45°
        ctx.save();
        ctx.translate(cx, padTop + chartH + 8);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right';
        ctx.fillStyle = C.dateLabel;
        ctx.font = '11px sans-serif';
        ctx.fillText(bar.name, 0, 0);
        ctx.restore();
    });
}

// --- Time-of-day weighted KDE ---

function drawTimeOfDay() {
    const canvas = document.getElementById('timeofday-chart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssWidth = wrap.clientWidth;
    const cssHeight = wrap.clientHeight;
    if (cssWidth < 10 || cssHeight < 10) return;

    const entries = getEntries();
    const C = getChartColors();
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (entries.length === 0) {
        ctx.fillStyle = C.yLabel;
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No entries yet', cssWidth / 2, cssHeight / 2);
        return;
    }

    // Extract (time_of_day_hours, weight_mg) pairs
    const points = entries.map(e => {
        const d = new Date(e.timestamp);
        return { t: d.getHours() + d.getMinutes() / 60, w: e.amount };
    });

    const totalWeight = points.reduce((s, p) => s + p.w, 0);
    const n = points.length;

    // Silverman's rule bandwidth on time-of-day values
    const mean = points.reduce((s, p) => s + p.t * p.w, 0) / totalWeight;
    const variance = points.reduce((s, p) => s + p.w * (p.t - mean) ** 2, 0) / totalWeight;
    const sigma = Math.sqrt(variance);
    const h = Math.min(Math.max(1.06 * sigma * Math.pow(n, -0.2), 0.4), 2.5);

    // Evaluate KDE on a grid of 360 points across [0, 24]
    const N_EVAL = 360;
    const density = new Float64Array(N_EVAL);
    const gaussian = u => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);

    for (let i = 0; i < N_EVAL; i++) {
        const x = (i / (N_EVAL - 1)) * 24;
        let d = 0;
        points.forEach(p => {
            // Wrap-around: mirror entries near midnight onto both sides
            for (const t of [p.t, p.t - 24, p.t + 24]) {
                d += p.w * gaussian((x - t) / h);
            }
        });
        density[i] = d / (totalWeight * h);
    }

    const maxDensity = Math.max(...density);

    const PAD_LEFT = 12, PAD_RIGHT = 12, PAD_TOP = 12, PAD_BOTTOM = 28;
    const chartW = cssWidth - PAD_LEFT - PAD_RIGHT;
    const chartH = cssHeight - PAD_TOP - PAD_BOTTOM;

    const xToCanvas = t => PAD_LEFT + (t / 24) * chartW;
    const yToCanvas = d => PAD_TOP + chartH - (d / maxDensity) * chartH;

    // Filled area
    const dark = isDarkMode();
    const fillColor = dark ? 'rgba(102,126,234,0.25)' : 'rgba(102,126,234,0.18)';
    const lineColor = '#667eea';

    ctx.beginPath();
    ctx.moveTo(xToCanvas(0), yToCanvas(density[0]));
    for (let i = 1; i < N_EVAL; i++) {
        ctx.lineTo(xToCanvas((i / (N_EVAL - 1)) * 24), yToCanvas(density[i]));
    }
    ctx.lineTo(xToCanvas(24), PAD_TOP + chartH);
    ctx.lineTo(xToCanvas(0), PAD_TOP + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Curve outline
    ctx.beginPath();
    ctx.moveTo(xToCanvas(0), yToCanvas(density[0]));
    for (let i = 1; i < N_EVAL; i++) {
        ctx.lineTo(xToCanvas((i / (N_EVAL - 1)) * 24), yToCanvas(density[i]));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Baseline
    ctx.strokeStyle = C.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, PAD_TOP + chartH);
    ctx.lineTo(PAD_LEFT + chartW, PAD_TOP + chartH);
    ctx.stroke();

    // X-axis labels every 3 hours
    const hourLabels = [
        [0, '12am'], [3, '3am'], [6, '6am'], [9, '9am'],
        [12, '12pm'], [15, '3pm'], [18, '6pm'], [21, '9pm'], [24, '12am']
    ];
    ctx.fillStyle = C.dateLabel;
    ctx.font = '10px sans-serif';
    ctx.textBaseline = 'top';
    hourLabels.forEach(([hr, label]) => {
        const x = xToCanvas(hr);
        ctx.textAlign = hr === 0 ? 'left' : hr === 24 ? 'right' : 'center';
        ctx.fillText(label, x, PAD_TOP + chartH + 6);
    });

    // Subtle tick marks
    hourLabels.forEach(([hr]) => {
        const x = xToCanvas(hr);
        ctx.strokeStyle = C.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, PAD_TOP + chartH);
        ctx.lineTo(x, PAD_TOP + chartH + 4);
        ctx.stroke();
    });
}

// --- Bedtime caffeine chart ---

const BEDTIME_HOUR = 23; // 11 pm

function getCaffeineAtTime(entries, targetTime) {
    return entries.reduce((sum, e) => {
        const consumed = new Date(e.timestamp);
        if (consumed >= targetTime) return sum;
        const hoursElapsed = (targetTime - consumed) / (1000 * 60 * 60);
        return sum + e.amount * Math.pow(0.5, hoursElapsed / getHalfLife());
    }, 0);
}

function drawBedtimeCaffeine() {
    const canvas = document.getElementById('bedtime-chart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssWidth = wrap.clientWidth;
    const cssHeight = wrap.clientHeight;
    if (cssWidth < 10 || cssHeight < 10) return;

    const entries = getEntries();
    const allDays = buildHistoryDays(); // reuse existing day-range builder
    if (allDays.length === 0) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = cssWidth * dpr; canvas.height = cssHeight * dpr;
        canvas.style.width = cssWidth + 'px'; canvas.style.height = cssHeight + 'px';
        ctx.scale(dpr, dpr);
        ctx.fillStyle = getChartColors().yLabel;
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No entries yet', cssWidth / 2, cssHeight / 2);
        return;
    }

    // Compute caffeine-at-bedtime for each day
    const points = allDays.map(({ date }) => {
        const bedtime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), BEDTIME_HOUR, 0, 0);
        return { date, value: getCaffeineAtTime(entries, bedtime) };
    });

    const PAD_LEFT = 50, PAD_RIGHT = 16, PAD_TOP = 16, PAD_BOTTOM = 50;
    const chartH = cssHeight - PAD_TOP - PAD_BOTTOM;

    const DAY_W = Math.max(20, Math.floor((cssWidth - PAD_LEFT - PAD_RIGHT) / points.length));
    // If many days, allow horizontal scroll like history chart
    const cssW = Math.max(cssWidth, PAD_LEFT + points.length * DAY_W + PAD_RIGHT);

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssHeight);

    const maxVal = Math.max(...points.map(p => p.value), 50);
    const scaleY = val => PAD_TOP + chartH - (val / maxVal) * chartH;
    const ptX = i => PAD_LEFT + i * DAY_W + DAY_W / 2;

    const C = getChartColors();

    // Gridlines at 0, half, max
    [0, Math.round(maxVal / 2), Math.round(maxVal)].forEach(v => {
        const y = scaleY(v);
        ctx.strokeStyle = C.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, y);
        ctx.lineTo(cssW - PAD_RIGHT, y);
        ctx.stroke();
        ctx.fillStyle = C.yLabel;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(v) + 'mg', PAD_LEFT - 5, y);
    });

    // Month boundary dashed lines
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    points.forEach((p, i) => {
        if (i > 0 && p.date.getDate() === 1) {
            const x = PAD_LEFT + i * DAY_W;
            ctx.strokeStyle = C.boundaryLine;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(x, PAD_TOP);
            ctx.lineTo(x, PAD_TOP + chartH);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#667eea';
            ctx.font = '600 11px sans-serif';
            ctx.fillText(MONTHS[p.date.getMonth()], x, PAD_TOP + chartH + 28);
            ctx.fillStyle = C.monthYear;
            ctx.font = '10px sans-serif';
            ctx.fillText(p.date.getFullYear(), x, PAD_TOP + chartH + 40);
        }
    });

    // Connecting line
    if (points.length > 1) {
        ctx.strokeStyle = '#764ba2';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((p, i) => {
            const x = ptX(i), y = scaleY(p.value);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    // Dots
    points.forEach((p, i) => {
        const x = ptX(i), y = scaleY(p.value);
        const isToday = i === points.length - 1;
        ctx.beginPath();
        ctx.arc(x, y, isToday ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#764ba2';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, isToday ? 3 : 2, 0, Math.PI * 2);
        ctx.fillStyle = C.dotCenter;
        ctx.fill();
    });

    // Adaptive x-axis date labels
    const tickInterval = points.length <= 21 ? 1
        : points.length <= 60 ? 7
        : points.length <= 180 ? 14 : 28;

    const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    points.forEach((p, i) => {
        const isToday = i === points.length - 1;
        if (!isToday && i % tickInterval !== 0) return;
        const x = ptX(i);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isToday ? C.todayLabel : C.dateLabel;
        ctx.font = `${isToday ? 600 : 400} 10px sans-serif`;
        ctx.fillText(`${String(p.date.getDate()).padStart(2,'0')}/${String(p.date.getMonth()+1).padStart(2,'0')}`, x, PAD_TOP + chartH + 4);
        ctx.fillStyle = isToday ? C.todayLabel : C.weekdayLabel;
        ctx.font = `${isToday ? 600 : 400} 9px sans-serif`;
        ctx.fillText(isToday ? 'Today' : WEEKDAYS[p.date.getDay()], x, PAD_TOP + chartH + 15);
    });
}

// --- Full history line chart ---

function getHistoryWindowDays(allDays) {
    if (allDays.length === 0) return [];
    const endIdx = Math.max(0, allDays.length - 1 - historyWindowOffset);
    const startIdx = Math.max(0, endIdx - 13);
    return allDays.slice(startIdx, endIdx + 1);
}

function updateHistoryNav() {
    const allDays = buildHistoryDays();
    const nav = document.getElementById('history-nav');
    if (!nav) return;

    if (historyMode !== 'window') {
        nav.style.display = 'none';
        return;
    }
    nav.style.display = 'flex';

    const windowDays = getHistoryWindowDays(allDays);
    const label = document.getElementById('history-window-label');
    if (windowDays.length > 0) {
        const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        label.textContent = `${fmt(windowDays[0].date)} – ${fmt(windowDays[windowDays.length - 1].date)}`;
    }

    document.getElementById('history-prev').disabled = historyWindowOffset >= allDays.length - 1;
    document.getElementById('history-next').disabled = historyWindowOffset <= 0;
}

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

    const PAD_LEFT = 50;
    const PAD_RIGHT = 20;
    const PAD_TOP = 20;
    const PAD_BOTTOM = 66;
    const CHART_H = 150;

    // Canvas is at least as wide as its container (so it renders at full resolution
    // even with few data points), and wider when there are many days (triggers scroll).
    const containerW = canvas.parentElement.clientWidth || 300;
    // Window mode: fill the container exactly (no scroll). All-time: fixed 44px columns.
    const DAY_W = historyMode === 'window'
        ? Math.max(30, Math.floor((containerW - PAD_LEFT - PAD_RIGHT) / days.length))
        : 44;
    const daysW = PAD_LEFT + days.length * DAY_W + PAD_RIGHT;
    const cssW = historyMode === 'window' ? containerW : Math.max(containerW, daysW);
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

    const C = getChartColors();

    // Y-axis gridlines and labels
    const gridSteps = [0, Math.round(maxVal / 2), maxVal];
    gridSteps.forEach(v => {
        const y = scaleY(v);
        ctx.strokeStyle = C.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, y);
        ctx.lineTo(cssW - PAD_RIGHT, y);
        ctx.stroke();

        ctx.fillStyle = C.yLabel;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(v + 'mg', PAD_LEFT - 5, y);
    });

    // Month boundary vertical dashed lines
    days.forEach((day, i) => {
        if (i > 0 && day.date.getDate() === 1) {
            const x = PAD_LEFT + i * DAY_W;
            ctx.strokeStyle = C.boundaryLine;
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
        ctx.fillStyle = C.dotCenter;
        ctx.fill();
    });

    // X-axis labels
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const labelY1 = PAD_TOP + CHART_H + 12; // date
    const labelY2 = PAD_TOP + CHART_H + 24; // weekday
    const labelY3 = PAD_TOP + CHART_H + 40; // month name (boundary label)
    const labelY4 = PAD_TOP + CHART_H + 52; // year (boundary label)

    // Month boundary labels — drawn at the dashed line x, between columns
    days.forEach((day, i) => {
        if (i > 0 && day.date.getDate() === 1) {
            const bx = PAD_LEFT + i * DAY_W; // boundary line x
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#667eea';
            ctx.font = '600 11px sans-serif';
            ctx.fillText(MONTHS[day.date.getMonth()], bx, labelY3);
            ctx.fillStyle = C.monthYear;
            ctx.font = '10px sans-serif';
            ctx.fillText(day.date.getFullYear(), bx, labelY4);
        }
    });

    // Adaptive tick interval: fewer labels as history grows
    const tickInterval = days.length <= 21 ? 1
        : days.length <= 60 ? 7
        : days.length <= 180 ? 14
        : 28;

    // Date/weekday labels — thinned by tick interval; today always shown
    days.forEach((day, i) => {
        const isToday = i === days.length - 1;
        if (!isToday && i % tickInterval !== 0) return;

        const x = dayX(i);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const d = String(day.date.getDate()).padStart(2, '0');
        const m = String(day.date.getMonth() + 1).padStart(2, '0');
        ctx.fillStyle = isToday ? C.todayLabel : C.dateLabel;
        ctx.font = `${isToday ? '600' : '400'} 10px sans-serif`;
        ctx.fillText(`${d}/${m}`, x, labelY1);
        ctx.fillStyle = isToday ? '#667eea' : C.weekdayLabel;
        ctx.font = `${isToday ? '600' : '400'} 10px sans-serif`;
        ctx.fillText(WEEKDAYS[day.date.getDay()], x, labelY2);
    });
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

// --- Server-based save (works in all browsers when running via npm run dev) ---
// The Express server in server.js writes data to data/caffeine_data.json on disk.

let serverAvailable = false;

async function checkServerAvailable() {
    try {
        const res = await fetch('/api/load', { method: 'GET' });
        serverAvailable = res.ok;
    } catch {
        serverAvailable = false;
    }
}

async function saveToServer() {
    if (!serverAvailable) return;
    const data = {
        version: 1,
        lastSaved: new Date().toISOString(),
        entries: getEntries(),
        halfLife: getHalfLife()
    };
    try {
        await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch {
        // Silent fail — server save is best-effort
    }
}

// On startup: if localStorage is empty but server has data, import it.
async function loadFromServer() {
    if (!serverAvailable) return false;
    try {
        const res = await fetch('/api/load');
        const data = await res.json();
        if (!data || !Array.isArray(data.entries) || data.entries.length === 0) return false;
        if (getEntries().length > 0) return false; // localStorage already has data
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.entries));
        if (data.halfLife) localStorage.setItem(HALFLIFE_KEY, String(data.halfLife));
        return true;
    } catch {
        return false;
    }
}

// --- IndexedDB helpers (for storing File System Access API folder handle) ---

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

// --- File System Access API backup (Chrome/Edge only, used on deployed version) ---

let backupDirHandle = null;

async function saveToFileSystem() {
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
        console.warn('File system backup failed:', e.message);
    }
}

// saveBackup: called after every data change. Uses server if available, otherwise
// falls back to File System Access API (Chrome on deployed version).
function saveBackup() {
    saveToServer();      // works in all browsers locally
    saveToFileSystem();  // Chrome/Edge on deployed version
}

async function importFromBackupFile(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.entries)) {
            showToast('Invalid backup file');
            return;
        }
        const existing = getEntries();
        const existingIds = new Set(existing.map(e => e.id));
        const newEntries = data.entries.filter(e => !existingIds.has(e.id));
        if (newEntries.length === 0) {
            showToast('No new entries to import');
            return;
        }
        const merged = [...existing, ...newEntries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        if (data.halfLife && !localStorage.getItem(HALFLIFE_KEY)) {
            localStorage.setItem(HALFLIFE_KEY, String(data.halfLife));
        }
        saveBackup();
        updateHalfLifeDisplay();
        refreshAll();
        showToast(`Imported ${newEntries.length} entr${newEntries.length === 1 ? 'y' : 'ies'}`);
    } catch {
        showToast('Could not read backup file');
    }
}

async function linkBackupFolder() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        backupDirHandle = handle;
        await setDBValue('backupDir', handle);
        updateBackupStatus();
        await saveToFileSystem();
        showToast('Folder linked — data saved');
    } catch (e) {
        if (e.name !== 'AbortError') showToast('Could not link folder');
    }
}

async function initBackup() {
    await checkServerAvailable();

    const statusEl = document.getElementById('backup-status');
    const noteEl = document.getElementById('backup-note');
    const btnEl = document.getElementById('backup-link');
    const rowEl = document.querySelector('.backup-row');

    if (serverAvailable) {
        // Running locally via npm run dev — server handles saving automatically
        if (statusEl) {
            statusEl.textContent = 'Auto-saving to data/caffeine_data.json';
            statusEl.className = 'backup-status backup-linked';
        }
        if (btnEl) btnEl.style.display = 'none';
        if (noteEl) noteEl.textContent = 'Data is automatically saved to the data/ folder in the project when running locally.';

        const imported = await loadFromServer();
        if (imported) {
            updateHalfLifeDisplay();
            refreshAll();
            showToast('Data restored from local backup');
        } else {
            // Save existing localStorage data to disk on first connection
            saveToServer();
        }
    } else if (window.showDirectoryPicker) {
        // Deployed version, Chrome/Edge — offer folder picker
        backupDirHandle = await getDBValue('backupDir');
        updateBackupStatus();
    } else {
        // Deployed version, Safari/Firefox — hide row (no option available)
        if (rowEl) rowEl.style.display = 'none';
        if (noteEl) noteEl.style.display = 'none';
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

// --- CSV export ---

function exportCSV() {
    const entries = getEntries()
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (entries.length === 0) {
        showToast('No data to export');
        return;
    }

    const escape = val => {
        const s = String(val ?? '');
        return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = entries.map(e => {
        const d = new Date(e.timestamp);
        const date = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
        const time = [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':');
        return [escape(date), escape(time), escape(e.amount), escape(e.source)].join(',');
    });

    const csv = ['date,time,amount_mg,source', ...rows].join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caffeine_data_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportJSON() {
    const entries = getEntries();
    if (entries.length === 0) { showToast('No data to export'); return; }
    const data = { version: 1, lastSaved: new Date().toISOString(), entries, halfLife: getHalfLife() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caffeine_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        if (file) importFromBackupFile(file);
        e.target.value = '';
    });
    document.getElementById('export-csv').addEventListener('click', exportCSV);
    document.getElementById('export-json').addEventListener('click', exportJSON);

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
        historyMode = 'all';
        document.getElementById('history-mode-all').classList.add('active');
        document.getElementById('history-mode-window').classList.remove('active');
        updateHistoryNav();
        drawHistoryChart();
    });

    document.getElementById('history-mode-window').addEventListener('click', () => {
        historyMode = 'window';
        historyWindowOffset = 0;
        document.getElementById('history-mode-window').classList.add('active');
        document.getElementById('history-mode-all').classList.remove('active');
        updateHistoryNav();
        drawHistoryChart();
    });

    document.getElementById('history-prev').addEventListener('click', () => {
        const allDays = buildHistoryDays();
        historyWindowOffset = Math.min(historyWindowOffset + 7, allDays.length - 1);
        updateHistoryNav();
        drawHistoryChart();
    });

    document.getElementById('history-next').addEventListener('click', () => {
        historyWindowOffset = Math.max(historyWindowOffset - 7, 0);
        updateHistoryNav();
        drawHistoryChart();
    });

    // Page navigation
    const pagesTrack = document.getElementById('pages-track');
    const navToAnalysis = document.getElementById('nav-to-analysis');
    const navToMain = document.getElementById('nav-to-main');

    navToAnalysis.addEventListener('click', () => {
        pagesTrack.classList.add('on-analysis');
        navToAnalysis.classList.add('hidden');
        navToMain.classList.remove('hidden');
    });

    navToMain.addEventListener('click', () => {
        pagesTrack.classList.remove('on-analysis');
        navToMain.classList.add('hidden');
        navToAnalysis.classList.remove('hidden');
    });

    // Forecast panel info tooltip (hover)
    const infoBtn     = document.getElementById('forecast-info-btn');
    const infoTooltip = document.getElementById('forecast-tooltip');
    if (infoBtn && infoTooltip) {
        let hideTimer;
        const show = () => { clearTimeout(hideTimer); infoTooltip.classList.add('visible'); };
        const hide = () => { hideTimer = setTimeout(() => infoTooltip.classList.remove('visible'), 120); };
        infoBtn.addEventListener('mouseenter', show);
        infoBtn.addEventListener('mouseleave', hide);
        infoTooltip.addEventListener('mouseenter', show);
        infoTooltip.addEventListener('mouseleave', hide);
    }

    // Minute tick: refresh level, entries, 7-day chart (not history chart)
    setInterval(refreshUI, 60 * 1000);
});
