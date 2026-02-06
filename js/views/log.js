/**
 * DiaMate Log View - Glucose, Meals, Insulin logging
 */
import { addEntry, updateEntry, deleteEntry, listEntries } from '../store.js';
import { getGlucoseStatus, getStatusColor } from '../safety.js';
import { formatRelativeTime, createToast, showConfirm, validateNumeric, showInputError, clearAllInputErrors, t } from '../utils.js';
import { getCurrentSubroute, navigateTo } from '../router.js';
import { renderDashboard } from './dashboard.js';

let currentTab = 'glucose';
let editingEntry = null;

/**
 * Initialize log view
 */
export function initLog() {
    renderLogView();
    wireLogEvents();
}

/**
 * Render log view based on current subroute
 */
export function renderLogView() {
    const subroute = getCurrentSubroute();
    
    if (subroute === 'add-glucose' || subroute === 'edit-glucose') {
        currentTab = 'glucose';
        renderGlucoseForm(subroute === 'edit-glucose');
    } else if (subroute === 'add-meal' || subroute === 'edit-meal') {
        currentTab = 'meals';
        renderMealForm(subroute === 'edit-meal');
    } else if (subroute === 'add-insulin' || subroute === 'edit-insulin') {
        currentTab = 'insulin';
        renderInsulinForm(subroute === 'edit-insulin');
    } else {
        renderLogHub();
    }
}

/**
 * Render log hub with tabs
 */
function renderLogHub() {
    const container = document.getElementById('glucoseScreen');
    if (!container) return;
    
    container.innerHTML = `
        <div style="background: white; border-radius: 24px; overflow: hidden; box-shadow: var(--shadow); margin-bottom: 16px;">
            <!-- Tabs -->
            <div style="display: flex; border-bottom: 1px solid var(--border);">
                <button class="log-tab ${currentTab === 'glucose' ? 'active' : ''}" data-tab="glucose" style="flex: 1; padding: 16px; border: none; background: ${currentTab === 'glucose' ? 'var(--primary)' : 'white'}; color: ${currentTab === 'glucose' ? 'white' : 'var(--text-secondary)'}; font-weight: 700; font-size: 14px; cursor: pointer;">
                    🩸 ${t('Glukoz', 'Glucose')}
                </button>
                <button class="log-tab ${currentTab === 'meals' ? 'active' : ''}" data-tab="meals" style="flex: 1; padding: 16px; border: none; background: ${currentTab === 'meals' ? 'var(--primary)' : 'white'}; color: ${currentTab === 'meals' ? 'white' : 'var(--text-secondary)'}; font-weight: 700; font-size: 14px; cursor: pointer;">
                    🍽️ ${t('Öğün', 'Meal')}
                </button>
                <button class="log-tab ${currentTab === 'insulin' ? 'active' : ''}" data-tab="insulin" style="flex: 1; padding: 16px; border: none; background: ${currentTab === 'insulin' ? 'var(--primary)' : 'white'}; color: ${currentTab === 'insulin' ? 'white' : 'var(--text-secondary)'}; font-weight: 700; font-size: 14px; cursor: pointer;">
                    💉 ${t('İnsülin', 'Insulin')}
                </button>
            </div>
            
            <!-- Add Button -->
            <div style="padding: 16px;">
                <button id="addEntryBtn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span style="font-size: 20px;">+</span>
                    <span id="addBtnText">${getAddButtonText()}</span>
                </button>
            </div>
        </div>
        
        <!-- Entry List -->
        <div style="background: white; border-radius: 24px; box-shadow: var(--shadow); padding: 20px;">
            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">${getListTitle()}</div>
            <div id="entryList">${renderEntryList()}</div>
        </div>
    `;
    
    wireLogHubEvents();
}

function getAddButtonText() {
    const texts = { 
        glucose: t('Glukoz Ekle', 'Add Glucose'), 
        meals: t('Öğün Ekle', 'Add Meal'), 
        insulin: t('İnsülin Ekle', 'Add Insulin') 
    };
    return texts[currentTab];
}

function getListTitle() {
    const titles = { 
        glucose: t('Glukoz Geçmişi', 'Glucose History'), 
        meals: t('Öğün Geçmişi', 'Meal History'), 
        insulin: t('İnsülin Geçmişi', 'Insulin History') 
    };
    return titles[currentTab];
}

function renderEntryList() {
    const entries = listEntries(currentTab);
    
    if (entries.length === 0) {
        const emptyTexts = {
            glucose: { icon: '🩸', title: t('Glukoz kaydı yok', 'No glucose records'), desc: t('İlk glukoz ölçümünüzü ekleyin', 'Add your first glucose reading') },
            meals: { icon: '🍽️', title: t('Öğün kaydı yok', 'No meal records'), desc: t('İlk öğününüzü kaydedin', 'Log your first meal') },
            insulin: { icon: '💉', title: t('İnsülin kaydı yok', 'No insulin records'), desc: t('İlk insülin dozunuzu kaydedin', 'Log your first insulin dose') }
        };
        const empty = emptyTexts[currentTab];
        return `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 12px;">${empty.icon}</div>
                <div style="font-weight: 600; margin-bottom: 6px;">${empty.title}</div>
                <div style="font-size: 13px;">${empty.desc}</div>
            </div>
        `;
    }
    
    return entries.slice(0, 20).map(entry => renderEntryItem(entry)).join('');
}

function renderEntryItem(entry) {
    if (currentTab === 'glucose') {
        const status = getGlucoseStatus(entry.value);
        const color = getStatusColor(status);
        return `
            <div class="entry-item" data-id="${entry.id}" style="display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--background); border-radius: 14px; margin-bottom: 10px; cursor: pointer;">
                <div style="width: 50px; height: 50px; background: ${color}15; border-radius: 14px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 20px; font-weight: 800; color: ${color};">${entry.value}</span>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${entry.value} mg/dL</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${getContextLabel(entry.context)} • ${formatRelativeTime(entry.ts)}</div>
                </div>
                <button class="delete-btn" data-id="${entry.id}" style="width: 36px; height: 36px; border: none; background: rgba(244,67,54,0.1); border-radius: 10px; color: #F44336; font-size: 16px; cursor: pointer;">✕</button>
            </div>
        `;
    } else if (currentTab === 'meals') {
        return `
            <div class="entry-item" data-id="${entry.id}" style="display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--background); border-radius: 14px; margin-bottom: 10px; cursor: pointer;">
                <div style="width: 50px; height: 50px; background: rgba(255,152,0,0.1); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🍽️</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${entry.items?.[0]?.name || t('Öğün', 'Meal')}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${entry.estimatedCarbs}g ${t('karb', 'carbs')} • ${formatRelativeTime(entry.ts)}</div>
                </div>
                <button class="delete-btn" data-id="${entry.id}" style="width: 36px; height: 36px; border: none; background: rgba(244,67,54,0.1); border-radius: 10px; color: #F44336; font-size: 16px; cursor: pointer;">✕</button>
            </div>
        `;
    } else {
        return `
            <div class="entry-item" data-id="${entry.id}" style="display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--background); border-radius: 14px; margin-bottom: 10px; cursor: pointer;">
                <div style="width: 50px; height: 50px; background: rgba(33,150,243,0.1); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">💉</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${entry.insulinType === 'rapid' ? t('Hızlı', 'Rapid') : t('Bazal', 'Basal')} ${t('İnsülin', 'Insulin')}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${entry.units}u • ${formatRelativeTime(entry.ts)}</div>
                </div>
                <button class="delete-btn" data-id="${entry.id}" style="width: 36px; height: 36px; border: none; background: rgba(244,67,54,0.1); border-radius: 10px; color: #F44336; font-size: 16px; cursor: pointer;">✕</button>
            </div>
        `;
    }
}

function getContextLabel(context) {
    const labels = {
        'fasting': t('Açlık', 'Fasting'),
        'before': t('Yemek Öncesi', 'Before Meal'),
        'after': t('Yemek Sonrası', 'After Meal'),
        'bedtime': t('Yatmadan Önce', 'Bedtime'),
        'random': t('Rastgele', 'Random')
    };
    return labels[context] || t('Ölçüm', 'Reading');
}

function wireLogHubEvents() {
    // Tab switching
    document.querySelectorAll('.log-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentTab = tab.dataset.tab;
            renderLogHub();
        });
    });
    
    // Add button
    const addBtn = document.getElementById('addEntryBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const routes = { glucose: 'add-glucose', meals: 'add-meal', insulin: 'add-insulin' };
            navigateTo('log', routes[currentTab]);
        });
    }
    
    // Entry items (edit)
    document.querySelectorAll('.entry-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            editingEntry = item.dataset.id;
            const routes = { glucose: 'edit-glucose', meals: 'edit-meal', insulin: 'edit-insulin' };
            navigateTo('log', routes[currentTab]);
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            showConfirm(t('Kaydı Sil', 'Delete Record'), t('Bu kaydı silmek istediğinizden emin misiniz?', 'Are you sure you want to delete this record?'), () => {
                deleteEntry(currentTab, id);
                createToast('success', t('Kayıt silindi', 'Record deleted'));
                renderLogHub();
                renderDashboard();
            });
        });
    });
}

function renderGlucoseForm(isEdit = false) {
    const container = document.getElementById('glucoseScreen');
    if (!container) return;
    
    let entry = null;
    if (isEdit && editingEntry) {
        const entries = listEntries('glucose');
        entry = entries.find(e => e.id === editingEntry);
    }
    
    container.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 24px; box-shadow: var(--shadow);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <button id="backBtn" style="width: 40px; height: 40px; border: none; background: var(--background); border-radius: 12px; font-size: 18px; cursor: pointer;">←</button>
                <div style="font-size: 20px; font-weight: 700;">${isEdit ? t('Glukoz Düzenle', 'Edit Glucose') : t('Glukoz Ekle', 'Add Glucose')}</div>
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('GLUKOZ DEĞERİ (mg/dL)', 'GLUCOSE VALUE (mg/dL)')}</label>
                <input type="number" id="glucoseValue" class="input" value="${entry?.value || ''}" placeholder="120" style="font-size: 24px; text-align: center; font-weight: 700; padding: 16px;">
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('ÖLÇÜM ZAMANI', 'MEASUREMENT CONTEXT')}</label>
                <select id="glucoseContext" class="input" style="padding: 16px;">
                    <option value="fasting" ${entry?.context === 'fasting' ? 'selected' : ''}>${t('Açlık (Sabah)', 'Fasting (Morning)')}</option>
                    <option value="before" ${entry?.context === 'before' ? 'selected' : ''}>${t('Yemek Öncesi', 'Before Meal')}</option>
                    <option value="after" ${entry?.context === 'after' ? 'selected' : ''}>${t('Yemek Sonrası (2 saat)', 'After Meal (2 hours)')}</option>
                    <option value="bedtime" ${entry?.context === 'bedtime' ? 'selected' : ''}>${t('Yatmadan Önce', 'Bedtime')}</option>
                    <option value="random" ${entry?.context === 'random' ? 'selected' : ''}>${t('Rastgele', 'Random')}</option>
                </select>
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('NOT (Opsiyonel)', 'NOTE (Optional)')}</label>
                <input type="text" id="glucoseNote" class="input" value="${entry?.note || ''}" placeholder="${t('Egzersiz sonrası, stresli gün vb.', 'After exercise, stressful day, etc.')}" style="padding: 16px;">
            </div>
            
            <button id="btnSaveGlucose" style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer;">
                ${isEdit ? t('Güncelle', 'Update') : t('Kaydet', 'Save')}
            </button>
        </div>
    `;
    
    wireGlucoseFormEvents(isEdit, entry?.id);
}

function wireGlucoseFormEvents(isEdit, entryId) {
    document.getElementById('backBtn')?.addEventListener('click', () => navigateTo('log'));
    
    document.getElementById('btnSaveGlucose')?.addEventListener('click', () => {
        clearAllInputErrors();
        
        const valueInput = document.getElementById('glucoseValue');
        const validation = validateNumeric(valueInput.value, 20, 600);
        
        if (!validation.valid) {
            showInputError('glucoseValue', validation.error);
            return;
        }
        
        const data = {
            value: validation.value,
            context: document.getElementById('glucoseContext').value,
            note: document.getElementById('glucoseNote').value
        };
        
        if (isEdit && entryId) {
            updateEntry('glucose', entryId, data);
            createToast('success', t('Glukoz güncellendi', 'Glucose updated'));
        } else {
            addEntry('glucose', data);
            createToast('success', t('Glukoz kaydedildi', 'Glucose saved'));
        }
        
        editingEntry = null;
        navigateTo('log');
        renderDashboard();
    });
}

function renderMealForm(isEdit = false) {
    const container = document.getElementById('glucoseScreen');
    if (!container) return;
    
    let entry = null;
    if (isEdit && editingEntry) {
        const entries = listEntries('meals');
        entry = entries.find(e => e.id === editingEntry);
    }
    
    container.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 24px; box-shadow: var(--shadow);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <button id="backBtn" style="width: 40px; height: 40px; border: none; background: var(--background); border-radius: 12px; font-size: 18px; cursor: pointer;">←</button>
                <div style="font-size: 20px; font-weight: 700;">${isEdit ? t('Öğün Düzenle', 'Edit Meal') : t('Öğün Ekle', 'Add Meal')}</div>
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('YEMEK ADI', 'MEAL NAME')}</label>
                <input type="text" id="mealName" class="input" value="${entry?.items?.[0]?.name || ''}" placeholder="${t('Pilav, tavuk, salata...', 'Rice, chicken, salad...')}" style="padding: 16px;">
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('TAHMİNİ KARBONHİDRAT (g)', 'ESTIMATED CARBS (g)')}</label>
                <input type="number" id="mealCarbs" class="input" value="${entry?.estimatedCarbs || ''}" placeholder="45" style="font-size: 20px; text-align: center; font-weight: 600; padding: 16px;">
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('NOT (Opsiyonel)', 'NOTE (Optional)')}</label>
                <input type="text" id="mealNote" class="input" value="${entry?.note || ''}" placeholder="${t('Restoranda, ev yemeği vb.', 'At restaurant, home cooked, etc.')}" style="padding: 16px;">
            </div>
            
            <button id="btnSaveMeal" style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer;">
                ${isEdit ? t('Güncelle', 'Update') : t('Kaydet', 'Save')}
            </button>
            
            <div style="text-align: center; margin-top: 16px;">
                <button id="goPhotoBtn" style="background: none; border: none; color: var(--primary); font-weight: 600; cursor: pointer; font-size: 14px;">
                    📸 ${t('Fotoğraf ile analiz et', 'Analyze with photo')}
                </button>
            </div>
        </div>
    `;
    
    wireMealFormEvents(isEdit, entry?.id);
}

function wireMealFormEvents(isEdit, entryId) {
    document.getElementById('backBtn')?.addEventListener('click', () => navigateTo('log'));
    document.getElementById('goPhotoBtn')?.addEventListener('click', () => navigateTo('analyze'));
    
    document.getElementById('btnSaveMeal')?.addEventListener('click', () => {
        clearAllInputErrors();
        
        const nameInput = document.getElementById('mealName');
        const carbsInput = document.getElementById('mealCarbs');
        
        if (!nameInput.value.trim()) {
            showInputError('mealName', t('Yemek adı girin', 'Enter meal name'));
            return;
        }
        
        const validation = validateNumeric(carbsInput.value, 0, 500);
        if (!validation.valid) {
            showInputError('mealCarbs', validation.error);
            return;
        }
        
        const data = {
            source: 'manual',
            items: [{ name: nameInput.value.trim(), carbs: validation.value }],
            estimatedCarbs: validation.value,
            note: document.getElementById('mealNote').value
        };
        
        if (isEdit && entryId) {
            updateEntry('meals', entryId, data);
            createToast('success', t('Öğün güncellendi', 'Meal updated'));
        } else {
            addEntry('meals', data);
            createToast('success', t('Öğün kaydedildi', 'Meal saved'));
        }
        
        editingEntry = null;
        navigateTo('log');
        renderDashboard();
    });
}

function renderInsulinForm(isEdit = false) {
    const container = document.getElementById('glucoseScreen');
    if (!container) return;
    
    let entry = null;
    if (isEdit && editingEntry) {
        const entries = listEntries('insulin');
        entry = entries.find(e => e.id === editingEntry);
    }
    
    container.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 24px; box-shadow: var(--shadow);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <button id="backBtn" style="width: 40px; height: 40px; border: none; background: var(--background); border-radius: 12px; font-size: 18px; cursor: pointer;">←</button>
                <div style="font-size: 20px; font-weight: 700;">${isEdit ? t('İnsülin Düzenle', 'Edit Insulin') : t('İnsülin Ekle', 'Add Insulin')}</div>
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('İNSÜLİN TİPİ', 'INSULIN TYPE')}</label>
                <select id="insulinType" class="input" style="padding: 16px;">
                    <option value="rapid" ${entry?.insulinType === 'rapid' ? 'selected' : ''}>${t('Hızlı Etkili (Bolus)', 'Rapid Acting (Bolus)')}</option>
                    <option value="basal" ${entry?.insulinType === 'basal' ? 'selected' : ''}>${t('Bazal (Uzun Etkili)', 'Basal (Long Acting)')}</option>
                </select>
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('ÜNİTE', 'UNITS')}</label>
                <input type="number" id="insulinUnits" class="input" value="${entry?.units || ''}" placeholder="6" step="0.5" style="font-size: 24px; text-align: center; font-weight: 700; padding: 16px;">
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('SEBEP', 'REASON')}</label>
                <select id="insulinReason" class="input" style="padding: 16px;">
                    <option value="meal" ${entry?.reason === 'meal' ? 'selected' : ''}>${t('Öğün', 'Meal')}</option>
                    <option value="correction" ${entry?.reason === 'correction' ? 'selected' : ''}>${t('Düzeltme', 'Correction')}</option>
                    <option value="both" ${entry?.reason === 'both' ? 'selected' : ''}>${t('Öğün + Düzeltme', 'Meal + Correction')}</option>
                    <option value="basal" ${entry?.reason === 'basal' ? 'selected' : ''}>${t('Bazal Doz', 'Basal Dose')}</option>
                </select>
            </div>
            
            <div class="input-group" style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('NOT (Opsiyonel)', 'NOTE (Optional)')}</label>
                <input type="text" id="insulinNote" class="input" value="${entry?.note || ''}" placeholder="${t('Ek bilgi...', 'Additional info...')}" style="padding: 16px;">
            </div>
            
            <button id="btnSaveInsulin" style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer;">
                ${isEdit ? t('Güncelle', 'Update') : t('Kaydet', 'Save')}
            </button>
        </div>
    `;
    
    wireInsulinFormEvents(isEdit, entry?.id);
}

function wireInsulinFormEvents(isEdit, entryId) {
    document.getElementById('backBtn')?.addEventListener('click', () => navigateTo('log'));
    
    document.getElementById('btnSaveInsulin')?.addEventListener('click', () => {
        clearAllInputErrors();
        
        const unitsInput = document.getElementById('insulinUnits');
        const validation = validateNumeric(unitsInput.value, 0.5, 100);
        
        if (!validation.valid) {
            showInputError('insulinUnits', validation.error);
            return;
        }
        
        const data = {
            insulinType: document.getElementById('insulinType').value,
            units: validation.value,
            reason: document.getElementById('insulinReason').value,
            note: document.getElementById('insulinNote').value
        };
        
        if (isEdit && entryId) {
            updateEntry('insulin', entryId, data);
            createToast('success', t('İnsülin güncellendi', 'Insulin updated'));
        } else {
            addEntry('insulin', data);
            createToast('success', t('İnsülin kaydedildi', 'Insulin saved'));
        }
        
        editingEntry = null;
        navigateTo('log');
        renderDashboard();
    });
}

function wireLogEvents() {
    // Events are wired in individual render functions
}

export { currentTab, editingEntry };
