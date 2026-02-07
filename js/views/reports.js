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
        <div style="background: white; padding: 24px; border-radius: 24px; margin-bottom: 16px; box-shadow: var(--shadow);">
            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px;">${t('Veri Dışa Aktar', 'Export Data')}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
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
            <button id="btnExportPDF" style="width: 100%; padding: 14px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer;">
                📄 ${t('PDF Rapor İndir', 'Download PDF Report')}
            </button>
        </div>
        
        <!-- Doctor Share -->
        <div style="background: white; padding: 24px; border-radius: 24px; box-shadow: var(--shadow);">
            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">${t('Doktor ile Paylaş', 'Share with Doctor')}</div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">${t('Verilerinizi doktorunuzla güvenli bir şekilde paylaşın', 'Securely share your data with your doctor')}</div>
            <button id="btnShareDoctor" style="width: 100%; padding: 14px; background: var(--info); color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                🔗 ${t('Paylaşım Linki Oluştur', 'Create Share Link')}
            </button>
            <div id="shareResult" style="display: none; margin-top: 12px; padding: 12px; background: var(--background); border-radius: 12px;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">${t('Bu linki doktorunuzla paylaşın:', 'Share this link with your doctor:')}</div>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="shareLink" readonly style="flex: 1; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 12px;">
                    <button id="btnCopyLink" style="padding: 10px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">📋</button>
                </div>
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
    
    // PDF Export
    const btnExportPDF = document.getElementById('btnExportPDF');
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', () => {
            generatePDFReport();
        });
    }
    
    // Doctor Share
    const btnShareDoctor = document.getElementById('btnShareDoctor');
    if (btnShareDoctor) {
        btnShareDoctor.addEventListener('click', () => {
            generateShareLink();
        });
    }
    
    // Copy Link
    const btnCopyLink = document.getElementById('btnCopyLink');
    if (btnCopyLink) {
        btnCopyLink.addEventListener('click', () => {
            const shareLink = document.getElementById('shareLink');
            if (shareLink) {
                navigator.clipboard.writeText(shareLink.value);
                createToast('success', t('Link kopyalandı', 'Link copied'));
            }
        });
    }
}

/**
 * Generate PDF Report (HTML-based printable)
 */
function generatePDFReport() {
    const fromTs = daysAgo(selectedDays);
    const glucoseEntries = listEntries('glucose', { fromTs });
    const mealEntries = listEntries('meals', { fromTs });
    const insulinEntries = listEntries('insulin', { fromTs });
    
    const glucoseValues = glucoseEntries.map(g => g.value);
    const avgGlucose = Math.round(mean(glucoseValues)) || 0;
    const stdDevGlucose = Math.round(stdDev(glucoseValues)) || 0;
    const inRange = glucoseValues.filter(v => v >= SafetyPolicy.hypoThreshold && v <= SafetyPolicy.hyperThreshold).length;
    const tirPercent = glucoseValues.length > 0 ? Math.round((inRange / glucoseValues.length) * 100) : 0;
    const estimatedA1c = avgGlucose > 0 ? ((avgGlucose + 46.7) / 28.7).toFixed(1) : '--';
    
    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>DiaMate Rapor - ${new Date().toLocaleDateString('tr-TR')}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { color: #2E7D32; border-bottom: 3px solid #2E7D32; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .stat-box { flex: 1; background: #f5f5f5; padding: 20px; border-radius: 10px; text-align: center; }
        .stat-value { font-size: 36px; font-weight: bold; color: #2E7D32; }
        .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #2E7D32; color: white; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        @media print { body { padding: 20px; } }
    </style>
</head>
<body>
    <h1>🩺 DiaMate Diyabet Raporu</h1>
    <p><strong>Dönem:</strong> Son ${selectedDays} gün (${new Date(fromTs).toLocaleDateString('tr-TR')} - ${new Date().toLocaleDateString('tr-TR')})</p>
    
    <div class="summary">
        <div class="stat-box">
            <div class="stat-value">${avgGlucose}</div>
            <div class="stat-label">Ortalama Glukoz (mg/dL)</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${tirPercent}%</div>
            <div class="stat-label">Hedefte Kalma Oranı</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${estimatedA1c}</div>
            <div class="stat-label">Tahmini A1c</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">±${stdDevGlucose}</div>
            <div class="stat-label">Standart Sapma</div>
        </div>
    </div>
    
    <h2>📊 Glukoz Ölçümleri (${glucoseEntries.length} kayıt)</h2>
    ${glucoseEntries.length > 0 ? `
    <table>
        <tr><th>Tarih</th><th>Saat</th><th>Değer</th><th>Bağlam</th></tr>
        ${glucoseEntries.slice(0, 50).map(g => `
            <tr>
                <td>${new Date(g.ts).toLocaleDateString('tr-TR')}</td>
                <td>${new Date(g.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td><strong>${g.value}</strong> mg/dL</td>
                <td>${g.context || '-'}</td>
            </tr>
        `).join('')}
    </table>
    ${glucoseEntries.length > 50 ? `<p><em>... ve ${glucoseEntries.length - 50} kayıt daha</em></p>` : ''}
    ` : '<p>Bu dönemde glukoz kaydı yok.</p>'}
    
    <h2>🍽️ Öğünler (${mealEntries.length} kayıt)</h2>
    ${mealEntries.length > 0 ? `
    <table>
        <tr><th>Tarih</th><th>Saat</th><th>Karbonhidrat</th><th>Detay</th></tr>
        ${mealEntries.slice(0, 30).map(m => `
            <tr>
                <td>${new Date(m.ts).toLocaleDateString('tr-TR')}</td>
                <td>${new Date(m.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td><strong>${m.estimatedCarbs || 0}</strong>g</td>
                <td>${m.items ? m.items.map(i => i.name).join(', ') : '-'}</td>
            </tr>
        `).join('')}
    </table>
    ` : '<p>Bu dönemde öğün kaydı yok.</p>'}
    
    <h2>💉 İnsülin Dozları (${insulinEntries.length} kayıt)</h2>
    ${insulinEntries.length > 0 ? `
    <table>
        <tr><th>Tarih</th><th>Saat</th><th>Doz</th><th>Tip</th></tr>
        ${insulinEntries.slice(0, 30).map(i => `
            <tr>
                <td>${new Date(i.ts).toLocaleDateString('tr-TR')}</td>
                <td>${new Date(i.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td><strong>${i.units}</strong> ünite</td>
                <td>${i.insulinType === 'rapid' ? 'Hızlı' : i.insulinType === 'long' ? 'Uzun' : i.insulinType}</td>
            </tr>
        `).join('')}
    </table>
    ` : '<p>Bu dönemde insülin kaydı yok.</p>'}
    
    <div class="footer">
        <p>Bu rapor DiaMate uygulaması tarafından ${new Date().toLocaleString('tr-TR')} tarihinde oluşturulmuştur.</p>
        <p>⚠️ Bu rapor sadece bilgilendirme amaçlıdır. Tıbbi kararlar için doktorunuza danışın.</p>
    </div>
</body>
</html>
    `;
    
    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    
    // Auto-trigger print dialog
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    createToast('success', t('Rapor oluşturuldu - yazdırabilirsiniz', 'Report generated - you can print it'));
}

/**
 * Generate shareable link for doctor
 */
function generateShareLink() {
    const fromTs = daysAgo(selectedDays);
    const glucoseEntries = listEntries('glucose', { fromTs });
    const mealEntries = listEntries('meals', { fromTs });
    const insulinEntries = listEntries('insulin', { fromTs });
    
    // Create summary data
    const shareData = {
        period: selectedDays,
        generated: new Date().toISOString(),
        glucose: glucoseEntries.slice(0, 100),
        meals: mealEntries.slice(0, 50),
        insulin: insulinEntries.slice(0, 50)
    };
    
    // Encode data (in real app, this would be stored on server and return a short link)
    const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
    const shareLink = `${window.location.origin}/share?data=${encoded.substring(0, 100)}`;
    
    // Show result
    const shareResult = document.getElementById('shareResult');
    const shareLinkInput = document.getElementById('shareLink');
    
    if (shareResult && shareLinkInput) {
        shareLinkInput.value = shareLink;
        shareResult.style.display = 'block';
    }
    
    createToast('success', t('Paylaşım linki oluşturuldu', 'Share link created'));
}
