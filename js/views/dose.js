/**
 * DiaMate Dose Calculator View
 */
import { getProfile, getLatestEntry, listEntries, addEntry } from '../store.js';
import { SafetyPolicy, isHypo } from '../safety.js';
import { roundToIncrement, createToast, showConfirm, validateNumeric, showInputError, clearAllInputErrors, t } from '../utils.js';
import { navigateTo } from '../router.js';
import { renderDashboard } from './dashboard.js';

let calculatedDose = null;
let acknowledgedMax = false;

/**
 * Initialize dose view
 */
export function initDose() {
    renderDoseCalculator();
}

/**
 * Calculate IOB (Insulin on Board)
 */
function calculateIOB(profile) {
    const activeHours = profile.activeInsulinHours || SafetyPolicy.defaultActiveInsulinHours;
    const cutoffTime = Date.now() - (activeHours * 60 * 60 * 1000);
    
    const recentInsulin = listEntries('insulin', { fromTs: cutoffTime })
        .filter(i => i.insulinType === 'rapid');
    
    let iob = 0;
    recentInsulin.forEach(entry => {
        const elapsedHours = (Date.now() - entry.ts) / (60 * 60 * 1000);
        const remaining = entry.units * Math.max(0, 1 - (elapsedHours / activeHours));
        iob += remaining;
    });
    
    return roundToIncrement(iob, 0.1);
}

/**
 * Render dose calculator
 */
export function renderDoseCalculator() {
    const container = document.getElementById('doseScreen');
    if (!container) return;
    
    const profile = getProfile();
    const latestGlucose = getLatestEntry('glucose');
    const latestMeal = getLatestEntry('meals');
    
    const defaultGlucose = latestGlucose?.value || '';
    const defaultCarbs = latestMeal && (Date.now() - latestMeal.ts < 30 * 60 * 1000) ? latestMeal.estimatedCarbs : '';
    
    container.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 24px; box-shadow: var(--shadow);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                <div style="width: 44px; height: 44px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px;">💉</div>
                <div style="font-size: 20px; font-weight: 700;">${t('İnsülin Doz Hesaplayıcı', 'Insulin Dose Calculator')}</div>
            </div>
            
            <!-- Warning Banner -->
            <div style="background: linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%); padding: 14px; border-radius: 14px; margin-bottom: 20px; border: 1px solid rgba(255,152,0,0.3);">
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <span style="font-size: 20px;">⚠️</span>
                    <div style="font-size: 12px; color: #BF360C; line-height: 1.4;">
                        <strong>${t('Önemli:', 'Important:')}</strong> ${t('Bu hesaplama sadece referans amaçlıdır. İnsülin dozlarınız için mutlaka doktorunuza danışın.', 'This calculation is for reference only. Always consult your doctor for insulin doses.')}
                    </div>
                </div>
            </div>
            
            <div class="input-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('MEVCUT KAN ŞEKERİ (mg/dL)', 'CURRENT BLOOD SUGAR (mg/dL)')}</label>
                <input type="number" id="doseGlucose" class="input" value="${defaultGlucose}" placeholder="180" style="font-size: 20px; text-align: center; font-weight: 600; padding: 14px;">
            </div>
            
            <div class="input-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('YİYECEĞİNİZ KARBONHİDRAT (g)', 'CARBS YOU WILL EAT (g)')}</label>
                <input type="number" id="doseCarbs" class="input" value="${defaultCarbs}" placeholder="60" style="font-size: 20px; text-align: center; font-weight: 600; padding: 14px;">
            </div>
            
            <div class="input-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${t('GLUKOZ TRENDİ', 'GLUCOSE TREND')}</label>
                <select id="glucoseTrend" class="input" style="padding: 14px;">
                    <option value="stable">→ ${t('Stabil', 'Stable')}</option>
                    <option value="rising">↑ ${t('Yükseliyor', 'Rising')}</option>
                    <option value="falling">↓ ${t('Düşüyor', 'Falling')}</option>
                </select>
            </div>
            
            <button id="btnCalculate" style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer;">
                ${t('Dozu Hesapla', 'Calculate Dose')}
            </button>
            
            <div id="doseResult"></div>
        </div>
    `;
    
    wireDoseEvents();
}

function wireDoseEvents() {
    document.getElementById('btnCalculate')?.addEventListener('click', calculateDose);
}

function calculateDose() {
    clearAllInputErrors();
    acknowledgedMax = false;
    
    const glucoseInput = document.getElementById('doseGlucose');
    const carbsInput = document.getElementById('doseCarbs');
    const trendSelect = document.getElementById('glucoseTrend');
    
    const glucoseValidation = validateNumeric(glucoseInput.value, 20, 600);
    if (!glucoseValidation.valid) {
        showInputError('doseGlucose', glucoseValidation.error);
        return;
    }
    
    const carbsValidation = validateNumeric(carbsInput.value, 0, 500);
    if (!carbsValidation.valid) {
        showInputError('doseCarbs', carbsValidation.error);
        return;
    }
    
    const glucose = glucoseValidation.value;
    const carbs = carbsValidation.value;
    const trend = trendSelect.value;
    
    const profile = getProfile();
    const resultContainer = document.getElementById('doseResult');
    
    // Check for hypoglycemia
    if (isHypo(glucose) && SafetyPolicy.blockWhenBelowHypo) {
        resultContainer.innerHTML = `
            <div style="margin-top: 20px; background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%); padding: 24px; border-radius: 20px; border: 2px solid #F44336;">
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 12px;">🚨</div>
                    <div style="font-size: 20px; font-weight: 800; color: #C62828; margin-bottom: 12px;">${t('HİPOGLİSEMİ UYARISI', 'HYPOGLYCEMIA WARNING')}</div>
                    <div style="font-size: 14px; color: #B71C1C; line-height: 1.5; margin-bottom: 16px;">
                        ${t(`Kan şekeriniz ${glucose} mg/dL ile düşük seviyede.`, `Your blood sugar is low at ${glucose} mg/dL.`)}<br>
                        <strong>${t('İnsülin uygulamayın!', 'Do NOT take insulin!')}</strong>
                    </div>
                    <div style="background: white; padding: 16px; border-radius: 14px; text-align: left;">
                        <div style="font-weight: 700; color: #C62828; margin-bottom: 10px;">${t('Hemen yapmanız gerekenler:', 'What to do immediately:')}</div>
                        <div style="font-size: 14px; color: #424242; line-height: 1.6;">
                            ${t(
                                '1. 15-20g hızlı karbonhidrat alın (meyve suyu, şeker)<br>2. 15 dakika bekleyin<br>3. Kan şekerinizi tekrar ölçün<br>4. Gerekirse tekrarlayın',
                                '1. Take 15-20g fast carbs (juice, sugar)<br>2. Wait 15 minutes<br>3. Check blood sugar again<br>4. Repeat if necessary'
                            )}
                        </div>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    // Calculate dose
    const icr = profile.icr || 10;
    const isf = profile.isf || 30;
    const targetMid = ((profile.targetLow || 70) + (profile.targetHigh || 140)) / 2;
    const maxBolus = profile.maxBolus || SafetyPolicy.maxBolusDefault;
    
    const mealBolus = carbs / icr;
    let correctionBolus = Math.max(0, (glucose - targetMid) / isf);
    
    // Apply trend adjustment
    if (trend === 'falling') {
        correctionBolus *= SafetyPolicy.trendDownCorrectionMultiplier;
    }
    
    const iob = calculateIOB(profile);
    let suggested = mealBolus + correctionBolus - iob;
    suggested = Math.max(SafetyPolicy.minBolus, suggested);
    suggested = roundToIncrement(suggested, SafetyPolicy.roundingIncrement);
    
    calculatedDose = suggested;
    
    // Check if above max
    const isAboveMax = suggested > maxBolus;
    const finalDose = isAboveMax ? maxBolus : suggested;
    
    renderDoseResult(glucose, carbs, mealBolus, correctionBolus, iob, finalDose, isAboveMax, maxBolus);
}

function renderDoseResult(glucose, carbs, mealBolus, correctionBolus, iob, finalDose, isAboveMax, maxBolus) {
    const resultContainer = document.getElementById('doseResult');
    
    let html = `
        <div style="margin-top: 20px;">
            <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); padding: 28px; border-radius: 24px; color: white; text-align: center; margin-bottom: 16px;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">${t('Hesaplanan Doz', 'Calculated Dose')}</div>
                <div style="font-size: 56px; font-weight: 800;">${finalDose.toFixed(1)}</div>
                <div style="font-size: 18px; opacity: 0.9;">${t('ünite insülin', 'units insulin')}</div>
            </div>
    `;
    
    if (isAboveMax) {
        html += `
            <div style="background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%); padding: 16px; border-radius: 16px; margin-bottom: 16px; border: 2px solid #FF9800;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <span style="font-size: 24px;">⚠️</span>
                    <span style="font-weight: 700; color: #E65100;">${t('Maksimum Doz Sınırı', 'Maximum Dose Limit')}</span>
                </div>
                <div style="font-size: 13px; color: #BF360C; line-height: 1.4;">
                    ${t(
                        `Hesaplanan doz (${calculatedDose.toFixed(1)}u) maksimum limitinizi (${maxBolus}u) aşıyor. Güvenlik için ${maxBolus}u olarak sınırlandırıldı.`,
                        `Calculated dose (${calculatedDose.toFixed(1)}u) exceeds your max limit (${maxBolus}u). Limited to ${maxBolus}u for safety.`
                    )}
                </div>
                <label style="display: flex; align-items: center; gap: 10px; margin-top: 12px; cursor: pointer;">
                    <input type="checkbox" id="ackMaxDose" style="width: 20px; height: 20px;">
                    <span style="font-size: 13px; color: #E65100;">${t('Bu dozu anladım ve onaylıyorum', 'I understand and confirm this dose')}</span>
                </label>
            </div>
        `;
    }
    
    html += `
            <div style="background: white; padding: 20px; border-radius: 20px; box-shadow: var(--shadow);">
                <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">${t('Hesaplama Detayları', 'Calculation Details')}</div>
                
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--background); border-radius: 12px; margin-bottom: 8px;">
                    <span style="color: var(--text-secondary);">${t('Öğün Dozu', 'Meal Dose')} (${carbs}g ÷ ICR)</span>
                    <span style="font-weight: 700; color: var(--primary);">${mealBolus.toFixed(1)}u</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--background); border-radius: 12px; margin-bottom: 8px;">
                    <span style="color: var(--text-secondary);">${t('Düzeltme Dozu', 'Correction Dose')}</span>
                    <span style="font-weight: 700; color: var(--info);">${correctionBolus.toFixed(1)}u</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--background); border-radius: 12px; margin-bottom: 8px;">
                    <span style="color: var(--text-secondary);">${t('Aktif İnsülin (IOB)', 'Active Insulin (IOB)')}</span>
                    <span style="font-weight: 700; color: var(--warning);">-${iob.toFixed(1)}u</span>
                </div>
                
                <div style="border-top: 2px solid var(--border); margin-top: 12px; padding-top: 12px;">
                    <div style="display: flex; justify-content: space-between; padding: 12px; background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); border-radius: 12px;">
                        <span style="font-weight: 700; color: var(--primary);">${t('Toplam', 'Total')}</span>
                        <span style="font-weight: 800; color: var(--primary);">${finalDose.toFixed(1)}u</span>
                    </div>
                </div>
            </div>
            
            <button id="recordDoseBtn" style="width: 100%; margin-top: 16px; padding: 16px; background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 20px;">💉</span>
                <span>${t('Bu Dozu Kaydet', 'Record This Dose')}</span>
            </button>
        </div>
    `;
    
    resultContainer.innerHTML = html;
    
    // Wire record button
    document.getElementById('recordDoseBtn')?.addEventListener('click', () => {
        if (isAboveMax && SafetyPolicy.requireAcknowledgementAboveMax) {
            const ackCheckbox = document.getElementById('ackMaxDose');
            if (!ackCheckbox?.checked) {
                createToast('warning', t('Lütfen maksimum doz uyarısını onaylayın', 'Please confirm the max dose warning'));
                return;
            }
        }
        
        if (SafetyPolicy.requireTwoStepConfirmForRecording) {
            showConfirm(
                t('Doz Kaydı', 'Dose Record'),
                t(`${finalDose.toFixed(1)} ünite hızlı insülin kaydedilecek. Onaylıyor musunuz?`, `${finalDose.toFixed(1)} units rapid insulin will be recorded. Confirm?`),
                () => recordDose(finalDose)
            );
        } else {
            recordDose(finalDose);
        }
    });
}

function recordDose(units) {
    addEntry('insulin', {
        insulinType: 'rapid',
        units: units,
        reason: 'both',
        note: t('Doz hesaplayıcıdan', 'From dose calculator')
    });
    
    createToast('success', t(`${units.toFixed(1)} ünite insülin kaydedildi`, `${units.toFixed(1)} units insulin recorded`));
    renderDashboard();
    
    // Clear result
    document.getElementById('doseResult').innerHTML = `
        <div style="margin-top: 20px; background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); padding: 24px; border-radius: 20px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 12px;">✓</div>
            <div style="font-size: 18px; font-weight: 700; color: var(--primary);">${t('Doz Kaydedildi!', 'Dose Recorded!')}</div>
            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">${units.toFixed(1)} ${t('ünite hızlı insülin', 'units rapid insulin')}</div>
        </div>
    `;
}

/**
 * Prefill carbs from external source (e.g., photo analysis)
 */
export function prefillCarbs(carbs) {
    const carbsInput = document.getElementById('doseCarbs');
    if (carbsInput) {
        carbsInput.value = carbs;
    }
}
