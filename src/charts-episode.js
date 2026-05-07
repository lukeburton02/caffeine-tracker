import { getHalfLife, computeLevelAt } from './calculations.js';
import { getEntries } from './storage.js';
import { isDarkMode, getChartColors } from './charts-shared.js';

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
