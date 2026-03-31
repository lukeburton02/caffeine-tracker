// Local dev server — serves the app and provides a /api/save + /api/load
// endpoint so data is written to disk (works in all browsers, including Safari).

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;
const DATA_FILE = path.join(__dirname, 'data', 'caffeine_data.json');

app.use(express.static(path.join(__dirname, 'src')));
app.use(express.json({ limit: '1mb' }));

// Save all data to disk
app.post('/api/save', (req, res) => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
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
