// Local dev server — serves the app and provides a /api/save + /api/load
// endpoint so data is written to disk (works in all browsers, including Safari).

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'caffeine_data.json');
const CSV_FILE  = path.join(DATA_DIR, 'caffeine_data.csv');

app.use(express.static(path.join(__dirname, 'src')));
app.use(express.json({ limit: '1mb' }));

// Returns a CSV-safe value: wraps in quotes if it contains a comma, quote, or newline
function csvField(val) {
    const s = String(val ?? '');
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Converts a UTC ISO timestamp to local YYYY-MM-DD and HH:MM strings
function localDateTime(isoString) {
    const d = new Date(isoString);
    const date = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
    ].join('-');
    const time = [
        String(d.getHours()).padStart(2, '0'),
        String(d.getMinutes()).padStart(2, '0'),
    ].join(':');
    return { date, time };
}

// Save all data to disk — writes both JSON and CSV
app.post('/api/save', (req, res) => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // JSON (source of truth — unchanged)
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');

    // CSV (human-readable companion)
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const rows = entries
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map(e => {
            const { date, time } = localDateTime(e.timestamp);
            return [csvField(date), csvField(time), csvField(e.amount), csvField(e.source)].join(',');
        });
    const csv = ['date,time,amount_mg,source', ...rows].join('\n') + '\n';
    fs.writeFileSync(CSV_FILE, csv, 'utf8');

    res.json({ ok: true });
});

// Load data from disk (used on startup if localStorage is empty)
app.get('/api/load', (req, res) => {
    if (fs.existsSync(DATA_FILE)) {
        res.json(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
    } else {
        res.json(null);
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Caffeine Tracker → http://127.0.0.1:${PORT}`);
});
