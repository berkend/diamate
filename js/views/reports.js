/**
 * DiaMate Reports View
 */
import { listEntries, downloadCSV } from '../store.js';
import { SafetyPolicy } from '../safety.js';
import { mean, stdDev, daysAgo, createToast, t } from '../utils.js';

let selectedDays = 7;

/**
 * Initialize reports view
 */
export function initReports() {
    renderReportsView();
}

/**
 * Render reports view
 */
export function renderReportsView() {
    const container = document.getElementById('reportsScreen');
    if (!container) return;
    
    const fromTs = daysAgo(selectedDays);
    const glucoseEntries = listEntries('glucose', { fromTs });
    const mealEntries = listEntries('meals', { fromTs });
    const insulinEntries = listEntries('insulin', { fromTs });
    
    // Calculate stats
    const glucoseValues = glucoseEntries.map(g => g.value);
    const avgGlucose = Math.round(mean(glucoseValues)) || 0;
    const stdDevGlucose = Math.round(stdDev(glucoseValues)) || 0;
    
    const inRange = glucoseValues.filter(v => v >= SafetyPolicy.hypoThreshold && v <= SafetyPolicy.hyperThreshold).length;
    const hypoCount = glucoseValues.filter(v => v < SafetyPolicy.hypoThreshold).length;
    const hyperCount = glucoseValues.filter(v => v > SafetyPolicy.hyperThreshold).length;
    const tirPercent = glucoseValues.length > 0 ? Math.round((inRange / glucoseValues.length) * 100) : 0;
    
    // Estimated A1c (rough formula)
    const estimatedA1c = avgGlucose > 0 ? ((avgGlucose + 46.7) / 28.7).toFixed(1) : '--';
    
    const totalCarbs = mealEntries.reduce((sum, m) => sum + (m.estimatedCarbs || 0), 0);
    const totalInsulin = insulinEntries.filter(i => i.insulinType === 'rapid').reduce((sum, i) => sum + (i.units || 0), 0);

    container.innerHTML = `
        <!-- Period Selector -->
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button class="period-btn ${selectedDays === 7 ? 'active' : ''}" data-days="7" style="flex: 1; padding: 12px; border: 2px solid ${selectedDays === 7 ? 'var(--primary)' : 'var(--border)'}; background: ${selectedDays === 7 ? 'var(--primary)' : 'white'}; color: ${selectedDays === 7 ? 'white' : 'var(--text-secondary)'}; border-radius: 12px; font-weight: 700; cursor: pointer;">${t('7 Gün', '7 Days')}</button>
            <button class="period-btn ${selectedDays === 14 ? 'active' : ''}" data-days="14" style="flex: 1; padding: 12px; border: 2px solid ${selectedDays === 14 ? 'var(--primary)' : 'var(--border)'}; background: ${selectedDays === 14 ? 'var(--primary)' : 'white'}; color: ${selectedDays === 14 ? 'white' : 'var(--text-secondary)'}; border-radius: 12px; font-weight: 700; cursor: pointer;">${t('14 Gün', '14 Days')}</button>
            <button class="period-btn ${selectedDays === 30 ? 'active' : ''}" data-days="30" style="flex: 1; padding: 12px; border: 2px solid ${selectedDays === 30 ? 'var(--primary)' : 'var(--border)'}; background: ${selectedDays === 30 ? 'var(--primary)' : 'white'}; color: ${selectedDays === 30 ? 'white' : 'var(--text-secondary)'}; border-radius: 12px; font-weight: 700; cursor: pointer;">${t('30 Gün', '30 Days')}</button>
        </div>
        
        <!-- Summary Card -->
        <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); padding: 24px; border-radius: 24px; margin-bottom: 16px; color: white;">
            <div style="font-size: 14px; opacity: 0.9; font-weight: 600; margin-bottom: 16px;">${t(`Son ${selectedDays} Gün Özeti`, `Last ${selectedDays} Days Summary`)}</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                <div style="text-align: center;">
                    <div style="font-size: 32px; font-weight: 800;">${avgGlucose || '--'}</div>
                    <div style="font-size: 12px; opacity: 0.9;">${t('Ort. Glukoz', 'Avg. Glucose')}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 32px; font-weight: 800;">${tirPercent}%</div>
                    <div style="font-size: 12px; opacity: 0.9;">${t('Hedefte', 'In Range')}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 32px; font-weight: 800;">${estimatedA1c}</div>
                    <div style="font-size: 12px; opacity: 0.9;">${t('Tah. A1c', 'Est. A1c')}</div>
                </div>
            </div>
        </div>
        
        <!-- Glucose Distribution -->
        <div style="background: white; padding: 24px; border-radius: 24px; margin-bottom: 16px; box-shadow: var(--shadow);">
            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">${t('Glukoz Dağılımı', 'Glucose Distribution')}</div>
            ${glucoseValues.length > 0 ? `
                <div style="display: flex; gap: 4px; height: 24px; border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
                    <div style="width: ${Math.round((hypoCount / glucoseValues.length) * 100)}%; background: var(--error); min-width: ${hypoCount > 0 ? '4px' : '0'};"></div>
                    <div style="width: ${tirPercent}%; background: var(--success);"></div>
                    <div style="width: ${Math.round((hyperCount / glucoseValues.length) * 100)}%; background: var(--warning); min-width: ${hyperCount > 0 ? '4px' : '0'};"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="width: 10px; height: 10px; background: var(--error); border-radius: 50%;"></div>
                        <span>${t('Düşük', 'Low')} ${hypoCount} (${Math.round((hypoCount / glucoseValues.length) * 100)}%)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="width: 10px; height: 10px; background: var(--success); border-radius: 50%;"></div>
                        <span>${t('Hedefte', 'In Range')} ${inRange} (${tirPercent}%)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="width: 10px; height: 10px; background: var(--warning); border-radius: 50%;"></div>
                        <span>${t('Yüksek', 'High')} ${hyperCount} (${Math.round((hyperCount / glucoseValues.length) * 100)}%)</span>
                    </div>
                </div>
            ` : `
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
                    <div>${t('Bu dönemde glukoz verisi yok', 'No glucose data for this period')}</div>
                </div>
            `}
        </div>
        
        <!-- Statistics -->
        <div style="background: white; padding: 24px; border-radius: 24px; margin-bottom: 16px; box-shadow: var(--shadow);">
            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">${t('İstatistikler', 'Statistics')}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="background: var(--background); padding: 16px; border-radius: 16px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 800; color: var(--primary);">${glucoseValues.length}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${t('Glukoz Ölçümü', 'Glucose Readings')}</div>
                </div>
                <div style="background: var(--background); padding: 16px; border-radius: 16px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 800; color: var(--info);">±${stdDevGlucose}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${t('Std. Sapma', 'Std. Dev.')}</div>
                </div>
                <div style="background: var(--background); padding: 16px; border-radius: 16px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 800; color: var(--accent);">${totalCarbs}g</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${t('Toplam Karb', 'Total Carbs')}</div>
                </div>
                <div style="background: var(--background); padding: 16px; border-radius: 16px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 800; color: var(--success);">${totalInsulin}u</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${t('Toplam İnsülin', 'Total Insulin')}</div>
                </div>
            </div>
        </div>
        
        <!-- Export -->
        <div style="background: white; padding: 24px; border-radius: 24px; box-shadow: var(--shadow);">
            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">${t('Veri Dışa Aktar', 'Export Data')}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <button class="export-btn" data-type="glucose" style="padding: 14px 10px; background: var(--background); border: 2px solid var(--border); border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer;">
                    🩸 ${t('Glukoz', 'Glucose')}
                </button>
                <button class="export-btn" data-type="meals" style="padding: 14px 10px; background: var(--background); border: 2px solid var(--border); border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer;">
                    🍽️ ${t('Öğün', 'Meals')}
                </button>
                <button class="export-btn" data-type="insulin" style="padding: 14px 10px; background: var(--background); border: 2px solid var(--border); border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer;">
                    💉 ${t('İnsülin', 'Insulin')}
                </button>
            </div>
        </div>
    `;
    
    wireReportsEvents();
}

function wireReportsEvents() {
    // Period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDays = parseInt(btn.dataset.days);
            renderReportsView();
        });
    });
    
    // Export buttons
    document.querySelectorAll('.export-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const fromTs = daysAgo(selectedDays);
            const success = downloadCSV(type, { fromTs });
            
            if (success) {
                createToast('success', t('CSV dosyası indirildi', 'CSV file downloaded'));
            } else {
                createToast('warning', t('Dışa aktarılacak veri yok', 'No data to export'));
            }
        });
    });
}
