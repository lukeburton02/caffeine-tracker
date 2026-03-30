// Caffeine Tracker - Main Application Logic

const CAFFEINE_HALF_LIFE_HOURS = 5;
const STORAGE_KEY = 'caffeine_entries';

// --- Caffeine calculation ---

// Returns how much caffeine from a single entry remains right now
function calculateCurrentCaffeine(entry) {
    const now = new Date();
    const consumed = new Date(entry.timestamp);
    const hoursElapsed = (now - consumed) / (1000 * 60 * 60);
    return entry.amount * Math.pow(0.5, hoursElapsed / CAFFEINE_HALF_LIFE_HOURS);
}

// Returns total current caffeine from all entries
function getTotalCurrentCaffeine() {
    return getEntries().reduce((total, entry) => {
        return total + calculateCurrentCaffeine(entry);
    }, 0);
}

// --- LocalStorage ---

function getEntries() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveEntry(entry) {
    const entries = getEntries();
    entries.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function deleteEntry(id) {
    const entries = getEntries().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// --- UI updates ---

function updateLevelDisplay() {
    const total = getTotalCurrentCaffeine();
    document.getElementById('current-level').textContent = total.toFixed(1) + ' mg';
    document.getElementById('last-updated').textContent =
        'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderEntries() {
    const list = document.getElementById('entry-list');
    const entries = getEntries().slice().reverse(); // most recent first

    if (entries.length === 0) {
        list.innerHTML = '<li class="entry-empty">No entries yet. Log your first caffeine above!</li>';
        return;
    }

    list.innerHTML = entries.map(entry => {
        const current = calculateCurrentCaffeine(entry).toFixed(1);
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const source = entry.source || 'Unknown';
        return `
            <li class="entry-item">
                <div class="entry-info">
                    <span class="entry-source">${source}</span>
                    <span class="entry-time">${time}</span>
                </div>
                <div class="entry-amounts">
                    <span class="entry-original">${entry.amount}mg</span>
                    <span class="entry-current">${current}mg now</span>
                </div>
                <button class="btn-delete" onclick="handleDelete('${entry.id}')" aria-label="Delete entry">✕</button>
            </li>
        `;
    }).join('');
}

function refreshUI() {
    cleanupDecayedEntries();
    updateLevelDisplay();
    renderEntries();
}

// --- Event handlers ---

function handleFormSubmit(e) {
    e.preventDefault();

    const amountInput = document.getElementById('amount');
    const timeInput = document.getElementById('time');
    const sourceInput = document.getElementById('source');

    // Build timestamp from today's date + chosen time
    const [hours, minutes] = timeInput.value.split(':').map(Number);
    const timestamp = new Date();
    timestamp.setHours(hours, minutes, 0, 0);

    const entry = {
        id: Date.now().toString(),
        timestamp: timestamp.toISOString(),
        amount: parseFloat(amountInput.value),
        source: sourceInput.value.trim()
    };

    saveEntry(entry);
    refreshUI();

    // Reset form but keep source for convenience
    amountInput.value = '';
    timeInput.value = '';
}

function handleDelete(id) {
    deleteEntry(id);
    refreshUI();
}

// --- Entry cleanup ---

// Remove entries where remaining caffeine has dropped below 1mg
function cleanupDecayedEntries() {
    const entries = getEntries();
    const active = entries.filter(e => calculateCurrentCaffeine(e) >= 1);
    const removed = entries.length - active.length;
    if (removed > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
        showToast(`${removed} fully decayed entr${removed === 1 ? 'y' : 'ies'} removed`);
    }
}

// --- Preset quick-add ---

function showToast(message) {
    const toast = document.getElementById('preset-toast');
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2000);
}

function handlePreset(amount, source) {
    const now = new Date();
    const entry = {
        id: Date.now().toString(),
        timestamp: now.toISOString(),
        amount,
        source
    };
    saveEntry(entry);
    refreshUI();
    showToast(`Logged ${amount}mg ${source}`);
}

// --- Init ---

function setDefaultTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('time').value = `${hh}:${mm}`;
}

document.addEventListener('DOMContentLoaded', () => {
    setDefaultTime();
    refreshUI();

    document.getElementById('log-form').addEventListener('submit', handleFormSubmit);

    // Preset buttons
    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = parseFloat(btn.dataset.amount);
            const source = btn.dataset.source;
            handlePreset(amount, source);
        });
    });

    // Auto-refresh caffeine level every minute
    setInterval(refreshUI, 60 * 1000);
});
