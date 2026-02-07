/**
 * DiaMate Data Store - LocalStorage based persistence
 */
import { uuid } from './utils.js';
import { SafetyPolicy } from './safety.js';

const DB_KEY = 'diamate_db_v1';
const CURRENT_VERSION = 1;

/**
 * Default database structure
 */
function getDefaultDB() {
    return {
        version: CURRENT_VERSION,
        profile: {
            id: uuid(),
            name: '',
            diabetesType: 'T1',
            units: 'mg/dL',
            targetLow: SafetyPolicy.defaultTargetLow,
            targetHigh: SafetyPolicy.defaultTargetHigh,
            icr: 10,
            isf: 30,
            activeInsulinHours: SafetyPolicy.defaultActiveInsulinHours,
            maxBolus: SafetyPolicy.maxBolusDefault,
            age: null,
            gender: null,
            height: null,
            weight: null,
            activityLevel: null,
            setupComplete: false,
            createdAt: Date.now()
        },
        glucose: [],
        meals: [],
        insulin: [],
        favoriteMeals: [],
        reminders: []
    };
}

/**
 * Initialize database
 */
export function initDB() {
    let db = null;
    
    try {
        const stored = localStorage.getItem(DB_KEY);
        if (stored) {
            db = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading DB:', e);
    }
    
    if (!db) {
        db = getDefaultDB();
        saveDB(db);
        return db;
    }
    
    // Migration
    if (!db.version || db.version < CURRENT_VERSION) {
        db = migrateDB(db);
        saveDB(db);
    }
    
    return db;
}

/**
 * Migrate database to current version
 */
function migrateDB(oldDB) {
    const newDB = getDefaultDB();
    
    // Preserve existing data
    if (oldDB.profile) {
        newDB.profile = { ...newDB.profile, ...oldDB.profile };
    }
    if (Array.isArray(oldDB.glucose)) {
        newDB.glucose = oldDB.glucose;
    }
    if (Array.isArray(oldDB.meals)) {
        newDB.meals = oldDB.meals;
    }
    if (Array.isArray(oldDB.insulin)) {
        newDB.insulin = oldDB.insulin;
    }
    
    // Migrate from old format if needed
    if (oldDB.userData) {
        newDB.profile.name = oldDB.userData.name || '';
        newDB.profile.age = oldDB.userData.age || null;
        newDB.profile.gender = oldDB.userData.gender || null;
        newDB.profile.height = oldDB.userData.height || null;
        newDB.profile.weight = oldDB.userData.weight || null;
        newDB.profile.diabetesType = oldDB.userData.diabetesType === 'type1' ? 'T1' : 
                                      oldDB.userData.diabetesType === 'type2' ? 'T2' : 'Other';
        newDB.profile.setupComplete = oldDB.userData.setupComplete || false;
    }
    
    // Migrate old glucose data
    if (oldDB.glucoseData && Array.isArray(oldDB.glucoseData)) {
        oldDB.glucoseData.forEach(g => {
            newDB.glucose.push({
                id: uuid(),
                ts: new Date(g.time).getTime(),
                value: parseInt(g.value),
                context: g.context || '',
                note: g.note || ''
            });
        });
    }
    
    // Migrate old meal data
    if (oldDB.mealData && Array.isArray(oldDB.mealData)) {
        oldDB.mealData.forEach(m => {
            newDB.meals.push({
                id: uuid(),
                ts: new Date(m.time).getTime(),
                source: 'manual',
                items: [{ name: m.name, carbs: parseInt(m.carbs) }],
                estimatedCarbs: parseInt(m.carbs),
                note: ''
            });
        });
    }
    
    newDB.version = CURRENT_VERSION;
    return newDB;
}

/**
 * Get database
 */
export function getDB() {
    try {
        const stored = localStorage.getItem(DB_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error getting DB:', e);
    }
    return initDB();
}

/**
 * Save database
 */
export function saveDB(db) {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        return true;
    } catch (e) {
        console.error('Error saving DB:', e);
        return false;
    }
}

/**
 * Get profile
 */
export function getProfile() {
    return getDB().profile;
}

/**
 * Set profile (partial update)
 */
export function setProfile(patch) {
    const db = getDB();
    db.profile = { ...db.profile, ...patch };
    saveDB(db);
    return db.profile;
}

/**
 * Add entry
 */
export function addEntry(type, entry) {
    const db = getDB();
    
    if (!['glucose', 'meals', 'insulin'].includes(type)) {
        console.error('Invalid entry type:', type);
        return null;
    }
    
    const newEntry = {
        id: uuid(),
        ts: Date.now(),
        ...entry
    };
    
    db[type].push(newEntry);
    saveDB(db);
    
    return newEntry;
}

/**
 * Update entry
 */
export function updateEntry(type, id, patch) {
    const db = getDB();
    
    if (!['glucose', 'meals', 'insulin'].includes(type)) {
        console.error('Invalid entry type:', type);
        return null;
    }
    
    const index = db[type].findIndex(e => e.id === id);
    if (index === -1) {
        console.error('Entry not found:', id);
        return null;
    }
    
    db[type][index] = { ...db[type][index], ...patch };
    saveDB(db);
    
    return db[type][index];
}

/**
 * Delete entry
 */
export function deleteEntry(type, id) {
    const db = getDB();
    
    if (!['glucose', 'meals', 'insulin'].includes(type)) {
        console.error('Invalid entry type:', type);
        return false;
    }
    
    const index = db[type].findIndex(e => e.id === id);
    if (index === -1) {
        console.error('Entry not found:', id);
        return false;
    }
    
    db[type].splice(index, 1);
    saveDB(db);
    
    return true;
}

/**
 * List entries with optional time filter
 */
export function listEntries(type, options = {}) {
    const db = getDB();
    
    if (!['glucose', 'meals', 'insulin'].includes(type)) {
        console.error('Invalid entry type:', type);
        return [];
    }
    
    let entries = [...db[type]];
    
    if (options.fromTs) {
        entries = entries.filter(e => e.ts >= options.fromTs);
    }
    
    if (options.toTs) {
        entries = entries.filter(e => e.ts <= options.toTs);
    }
    
    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => b.ts - a.ts);
    
    return entries;
}

/**
 * Get latest entry
 */
export function getLatestEntry(type) {
    const entries = listEntries(type);
    return entries.length > 0 ? entries[0] : null;
}

/**
 * Get entries for today
 */
export function getTodayEntries(type) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return listEntries(type, { fromTs: today.getTime() });
}

/**
 * Export to CSV
 */
export function exportCSV(type, options = {}) {
    const entries = listEntries(type, options);
    
    if (entries.length === 0) {
        return '';
    }
    
    let headers = [];
    let rows = [];
    
    switch (type) {
        case 'glucose':
            headers = ['Tarih', 'Saat', 'Değer (mg/dL)', 'Bağlam', 'Not'];
            rows = entries.map(e => {
                const date = new Date(e.ts);
                return [
                    date.toLocaleDateString('tr-TR'),
                    date.toLocaleTimeString('tr-TR'),
                    e.value,
                    e.context || '',
                    e.note || ''
                ];
            });
            break;
            
        case 'meals':
            headers = ['Tarih', 'Saat', 'Kaynak', 'Tahmini Karb (g)', 'Yemekler', 'Not'];
            rows = entries.map(e => {
                const date = new Date(e.ts);
                const items = e.items ? e.items.map(i => `${i.name}:${i.carbs}g`).join('; ') : '';
                return [
                    date.toLocaleDateString('tr-TR'),
                    date.toLocaleTimeString('tr-TR'),
                    e.source || 'manual',
                    e.estimatedCarbs,
                    items,
                    e.note || ''
                ];
            });
            break;
            
        case 'insulin':
            headers = ['Tarih', 'Saat', 'Tip', 'Ünite', 'Sebep', 'Not'];
            rows = entries.map(e => {
                const date = new Date(e.ts);
                return [
                    date.toLocaleDateString('tr-TR'),
                    date.toLocaleTimeString('tr-TR'),
                    e.insulinType || 'rapid',
                    e.units,
                    e.reason || '',
                    e.note || ''
                ];
            });
            break;
    }
    
    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(type, options = {}) {
    const csv = exportCSV(type, options);
    
    if (!csv) {
        return false;
    }
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `diamate_${type}_${date}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
    return true;
}

/**
 * Reset database
 */
export function resetDB() {
    localStorage.removeItem(DB_KEY);
    // Also remove old format data
    localStorage.removeItem('diamateProV2');
    localStorage.removeItem('diamateInvestorPro');
    return initDB();
}

/**
 * Check if setup is complete
 */
export function isSetupComplete() {
    const profile = getProfile();
    return profile && profile.setupComplete === true;
}

// ==========================================
// FAVORITE MEALS
// ==========================================

/**
 * Add favorite meal
 */
export function addFavoriteMeal(meal) {
    const db = getDB();
    if (!db.favoriteMeals) db.favoriteMeals = [];
    
    const newMeal = {
        id: uuid(),
        name: meal.name,
        items: meal.items || [],
        totalCarbs: meal.totalCarbs || 0,
        createdAt: Date.now(),
        usageCount: 0
    };
    
    db.favoriteMeals.push(newMeal);
    saveDB(db);
    return newMeal;
}

/**
 * Get favorite meals
 */
export function getFavoriteMeals() {
    const db = getDB();
    return db.favoriteMeals || [];
}

/**
 * Update favorite meal usage count
 */
export function useFavoriteMeal(id) {
    const db = getDB();
    if (!db.favoriteMeals) return null;
    
    const meal = db.favoriteMeals.find(m => m.id === id);
    if (meal) {
        meal.usageCount = (meal.usageCount || 0) + 1;
        meal.lastUsed = Date.now();
        saveDB(db);
    }
    return meal;
}

/**
 * Delete favorite meal
 */
export function deleteFavoriteMeal(id) {
    const db = getDB();
    if (!db.favoriteMeals) return false;
    
    const index = db.favoriteMeals.findIndex(m => m.id === id);
    if (index === -1) return false;
    
    db.favoriteMeals.splice(index, 1);
    saveDB(db);
    return true;
}

// ==========================================
// REMINDERS
// ==========================================

/**
 * Add reminder
 */
export function addReminder(reminder) {
    const db = getDB();
    if (!db.reminders) db.reminders = [];
    
    const newReminder = {
        id: uuid(),
        type: reminder.type, // 'glucose', 'insulin', 'meal', 'custom'
        title: reminder.title,
        time: reminder.time, // HH:MM format
        days: reminder.days || [0,1,2,3,4,5,6], // 0=Sunday
        enabled: true,
        createdAt: Date.now()
    };
    
    db.reminders.push(newReminder);
    saveDB(db);
    return newReminder;
}

/**
 * Get reminders
 */
export function getReminders() {
    const db = getDB();
    return db.reminders || [];
}

/**
 * Toggle reminder
 */
export function toggleReminder(id) {
    const db = getDB();
    if (!db.reminders) return null;
    
    const reminder = db.reminders.find(r => r.id === id);
    if (reminder) {
        reminder.enabled = !reminder.enabled;
        saveDB(db);
    }
    return reminder;
}

/**
 * Delete reminder
 */
export function deleteReminder(id) {
    const db = getDB();
    if (!db.reminders) return false;
    
    const index = db.reminders.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    db.reminders.splice(index, 1);
    saveDB(db);
    return true;
}
