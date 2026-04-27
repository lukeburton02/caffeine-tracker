import { getHalfLife, HALFLIFE_KEY } from './calculations.js';
import { showToast } from './toast.js';

export const STORAGE_KEY = 'caffeine_entries';

// --- LocalStorage ---
// All entries are kept forever — never auto-deleted — so charts always have full history.

export function getEntries() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveEntry(entry) {
    try {
        const entries = getEntries();
        entries.push(entry);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        saveBackup();
    } catch {
        showToast('Could not save entry — storage may be full');
    }
}

export function deleteEntry(id) {
    try {
        const entries = getEntries().filter(e => e.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        saveBackup();
    } catch {
        showToast('Could not delete entry');
    }
}

// --- Server-based save (works in all browsers when running via npm run dev) ---

export let serverAvailable = false;

export async function checkServerAvailable() {
    if (!/^(localhost|127\.)/.test(location.hostname)) { serverAvailable = false; return; }
    try {
        const res = await fetch('/api/load', { method: 'GET' });
        serverAvailable = res.ok;
    } catch {
        serverAvailable = false;
    }
}

export async function saveToServer() {
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
export async function loadFromServer() {
    if (!serverAvailable) return false;
    try {
        const res = await fetch('/api/load');
        const data = await res.json();
        if (!data || !Array.isArray(data.entries) || data.entries.length === 0) return false;
        if (getEntries().length > 0) return false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.entries));
        if (data.halfLife) localStorage.setItem(HALFLIFE_KEY, String(data.halfLife));
        return true;
    } catch {
        return false;
    }
}

// --- IndexedDB helpers (for storing File System Access API folder handle) ---

export function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('caffeine-tracker', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('settings');
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject(new Error('IndexedDB unavailable'));
    });
}

export async function getDBValue(key) {
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

export async function setDBValue(key, value) {
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

export let backupDirHandle = null;

export async function saveToFileSystem() {
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

// saveBackup: called after every data change.
export function saveBackup() {
    saveToServer();
    saveToFileSystem();
}

// --- Backup management (accepts callbacks to avoid circular UI dependencies) ---

// onDataLoaded: called when server/file data is imported on startup
export async function initBackup({ onDataLoaded, updateBackupStatus }) {
    await checkServerAvailable();

    const statusEl  = document.getElementById('backup-status');
    const noteEl    = document.getElementById('backup-note');
    const btnEl     = document.getElementById('backup-link');
    const sectionEl = document.getElementById('backup-section');

    if (serverAvailable) {
        if (statusEl) {
            statusEl.textContent = 'Auto-saving to data/caffeine_data.json';
            statusEl.className = 'backup-status backup-linked';
        }
        if (btnEl) btnEl.style.display = 'none';
        if (noteEl) noteEl.textContent = 'Data is automatically saved to the data/ folder in the project when running locally.';

        const imported = await loadFromServer();
        if (imported) {
            onDataLoaded();
            showToast('Data restored from local backup');
        } else {
            saveToServer();
        }
    } else if (window.showDirectoryPicker) {
        backupDirHandle = await getDBValue('backupDir');
        updateBackupStatus();
    } else {
        if (sectionEl) sectionEl.style.display = 'none';
    }
}

export function updateBackupStatus() {
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

export async function linkBackupFolder() {
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

export async function importFromBackupFile(file, { onImport }) {
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
        onImport();
        showToast(`Imported ${newEntries.length} entr${newEntries.length === 1 ? 'y' : 'ies'}`);
    } catch {
        showToast('Could not read backup file');
    }
}

// --- CSV / JSON export ---

export function exportCSV() {
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

export function exportJSON() {
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
