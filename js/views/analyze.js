/**
 * DiaMate Photo Analysis View - Production Server-Side AI
 * Real AI photo analysis via Netlify Functions
 */
import { addEntry } from '../store.js';
import { createToast, t, getLang } from '../utils.js';
import { navigateTo } from '../router.js';
import { renderDashboard } from './dashboard.js';
import { prefillCarbs } from './dose.js';
import { analyzePhoto } from '../ai-assistant.js';

let analysisResult = null;
let currentImageData = null;

/**
 * Initialize analyze view
 */
export function initAnalyze() {
    renderAnalyzeView();
}

/**
 * Render analyze view
 */
export function renderAnalyzeView() {
    const container = document.getElementById('photoScreen');
    if (!container) return;
    
    const lang = getLang();
    
    container.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 24px; box-shadow: var(--shadow);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 44px; height: 44px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px;">🤖</div>
                <div style="font-size: 20px; font-weight: 700;">${t('AI Yemek Analizi', 'AI Food Analysis')}</div>
            </div>
            
            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px; line-height: 1.5;">
                ${t('Yemeğinizin fotoğrafını çekin, yapay zeka besin değerlerini tahmin etsin.', 'Take a photo of your food, AI will estimate nutritional values.')}
            </p>
            
            <div id="photoUpload" style="border: 2px dashed var(--border); border-radius: 20px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.3s; background: var(--background);">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <span style="font-size: 36px;">📸</span>
                </div>
                <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">${t('Fotoğraf Yükle', 'Upload Photo')}</div>
                <div style="font-size: 13px; color: var(--text-secondary);">${t('Tıklayın veya sürükleyip bırakın', 'Click or drag and drop')}</div>
            </div>
            
            <input type="file" id="photoInput" accept="image/*" capture="environment" style="display: none;">
            
            <div id="photoPreview" style="display: none; margin-top: 20px;">
                <div style="position: relative; border-radius: 20px; overflow: hidden; margin-bottom: 16px;">
                    <img id="previewImage" style="width: 100%; max-height: 250px; object-fit: cover;">
                    <button id="btnRemovePhoto" style="position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.6); border: none; color: white; font-size: 18px; cursor: pointer;">✕</button>
                </div>
                <button id="btnAnalyze" style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <span style="font-size: 20px;">🤖</span>
                    <span>${t('AI Analizi Başlat', 'Start AI Analysis')}</span>
                </button>
            </div>
            
            <div id="analysisLoading" style="display: none; text-align: center; padding: 40px 20px;">
                <div style="width: 60px; height: 60px; border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${t('AI Analiz Ediyor...', 'AI Analyzing...')}</div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 6px;">${t('Yemekler tanınıyor', 'Recognizing foods')}</div>
            </div>
            
            <div id="analysisError" style="display: none; margin-top: 20px;"></div>
            
            <style>
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
            
            <div id="analysisResult"></div>
        </div>
    `;
    
    wireAnalyzeEvents();
}

function wireAnalyzeEvents() {
    const photoUpload = document.getElementById('photoUpload');
    const photoInput = document.getElementById('photoInput');
    const photoPreview = document.getElementById('photoPreview');
    const previewImage = document.getElementById('previewImage');
    const btnRemovePhoto = document.getElementById('btnRemovePhoto');
    const btnAnalyze = document.getElementById('btnAnalyze');
    
    photoUpload?.addEventListener('click', () => photoInput?.click());
    
    // Drag and drop
    photoUpload?.addEventListener('dragover', (e) => {
        e.preventDefault();
        photoUpload.style.borderColor = 'var(--primary)';
        photoUpload.style.background = '#E3F2FD';
    });
    
    photoUpload?.addEventListener('dragleave', () => {
        photoUpload.style.borderColor = 'var(--border)';
        photoUpload.style.background = 'var(--background)';
    });
    
    photoUpload?.addEventListener('drop', (e) => {
        e.preventDefault();
        photoUpload.style.borderColor = 'var(--border)';
        photoUpload.style.background = 'var(--background)';
        
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
    });
    
    photoInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleImageFile(file);
    });
    
    btnRemovePhoto?.addEventListener('click', resetAnalysis);
    btnAnalyze?.addEventListener('click', runAIAnalysis);
}

function handleImageFile(file) {
    const photoPreview = document.getElementById('photoPreview');
    const photoUpload = document.getElementById('photoUpload');
    const previewImage = document.getElementById('previewImage');
    
    // Compress image if too large
    const maxSize = 1.5 * 1024 * 1024; // 1.5MB
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        
        // Check size and compress if needed
        if (dataUrl.length > maxSize * 1.33) { // base64 is ~33% larger
            compressImage(dataUrl, (compressedDataUrl) => {
                currentImageData = compressedDataUrl;
                if (previewImage) previewImage.src = compressedDataUrl;
                if (photoPreview) photoPreview.style.display = 'block';
                if (photoUpload) photoUpload.style.display = 'none';
            });
        } else {
            currentImageData = dataUrl;
            if (previewImage) previewImage.src = dataUrl;
            if (photoPreview) photoPreview.style.display = 'block';
            if (photoUpload) photoUpload.style.display = 'none';
        }
        
        document.getElementById('analysisResult').innerHTML = '';
        document.getElementById('analysisError').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function compressImage(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1024;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > maxDim) {
            height = (height * maxDim) / width;
            width = maxDim;
        } else if (height > maxDim) {
            width = (width * maxDim) / height;
            height = maxDim;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
}

function resetAnalysis() {
    const photoPreview = document.getElementById('photoPreview');
    const photoUpload = document.getElementById('photoUpload');
    const photoInput = document.getElementById('photoInput');
    
    if (photoPreview) photoPreview.style.display = 'none';
    if (photoUpload) photoUpload.style.display = 'block';
    if (photoInput) photoInput.value = '';
    
    document.getElementById('analysisResult').innerHTML = '';
    document.getElementById('analysisError').style.display = 'none';
    
    analysisResult = null;
    currentImageData = null;
}

async function runAIAnalysis() {
    if (!currentImageData) return;
    
    const photoPreview = document.getElementById('photoPreview');
    const loadingEl = document.getElementById('analysisLoading');
    const errorEl = document.getElementById('analysisError');
    const resultEl = document.getElementById('analysisResult');
    const lang = getLang();
    
    if (photoPreview) photoPreview.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    
    try {
        const result = await analyzePhoto(currentImageData);
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (result.error) {
            showError(result.message);
            if (photoPreview) photoPreview.style.display = 'block';
            return;
        }
        
        // Store result
        analysisResult = {
            items: result.items.map(item => ({
                name: item.name,
                portion: item.portion || '',
                carbs: item.carbs_g || 0,
                confidence: item.confidence || 'medium'
            })),
            estimatedCarbs: result.totalCarbs,
            notes: result.notes,
            confidence: result.confidence
        };
        
        renderAnalysisResult();
        
    } catch (error) {
        console.error('Analysis error:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        showError(lang === 'en' 
            ? '❌ Analysis failed. Please try again.' 
            : '❌ Analiz başarısız. Tekrar deneyin.');
        if (photoPreview) photoPreview.style.display = 'block';
    }
}

function showError(message) {
    const errorEl = document.getElementById('analysisError');
    if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.innerHTML = `
            <div style="background: #FEE2E2; border: 1px solid #FECACA; padding: 16px; border-radius: 14px; color: #DC2626;">
                ${message}
            </div>
        `;
    }
}

function renderAnalysisResult() {
    const resultEl = document.getElementById('analysisResult');
    if (!resultEl || !analysisResult) return;
    
    const { items, estimatedCarbs, notes, confidence } = analysisResult;
    const lang = getLang();
    
    const confidenceText = {
        high: lang === 'en' ? 'High' : 'Yüksek',
        medium: lang === 'en' ? 'Medium' : 'Orta',
        low: lang === 'en' ? 'Low' : 'Düşük'
    };
    
    let html = `
        <div style="margin-top: 20px;">
            <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); padding: 24px; border-radius: 20px; color: white; text-align: center; margin-bottom: 16px;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">${t('Toplam Karbonhidrat', 'Total Carbohydrates')}</div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <input type="number" id="editTotalCarbs" value="${estimatedCarbs}" style="width: 100px; font-size: 40px; font-weight: 800; text-align: center; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4); border-radius: 12px; color: white; padding: 8px;">
                    <span style="font-size: 24px;">g</span>
                </div>
                <div style="font-size: 13px; opacity: 0.8; margin-top: 8px;">${t('Güven:', 'Confidence:')} ${confidenceText[confidence] || confidence}</div>
            </div>
            
            ${notes ? `
                <div style="background: #E3F2FD; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; font-size: 13px; color: #1565C0;">
                    💡 ${notes}
                </div>
            ` : ''}
            
            <div style="background: white; padding: 20px; border-radius: 20px; box-shadow: var(--shadow); margin-bottom: 16px;">
                <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    <span>🤖</span> ${t('Tespit Edilen Yemekler', 'Detected Foods')}
                </div>
    `;
    
    if (items.length === 0) {
        html += `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                ${t('Yemek tespit edilemedi', 'No food detected')}
            </div>
        `;
    } else {
        items.forEach((item, index) => {
            html += `
                <div style="display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--background); border-radius: 14px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${item.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${item.portion || ''} ${item.confidence ? `• ${confidenceText[item.confidence] || item.confidence}` : ''}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <input type="number" class="item-carbs" data-index="${index}" value="${item.carbs}" style="width: 60px; padding: 8px; text-align: center; font-weight: 700; border: 2px solid var(--border); border-radius: 10px; font-size: 16px;">
                        <span style="color: var(--text-secondary);">g</span>
                    </div>
                </div>
            `;
        });
    }
    
    html += `
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <button id="saveMealBtn" style="padding: 16px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer;">
                    💾 ${t('Öğün Kaydet', 'Save Meal')}
                </button>
                <button id="calcDoseBtn" style="padding: 16px; background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; border: none; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer;">
                    💉 ${t('Doz Hesapla', 'Calculate Dose')}
                </button>
            </div>
            
            <button id="retryAnalysisBtn" style="width: 100%; margin-top: 12px; padding: 12px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; font-size: 14px; cursor: pointer; color: var(--text-secondary);">
                🔄 ${t('Yeni Fotoğraf', 'New Photo')}
            </button>
        </div>
    `;
    
    resultEl.innerHTML = html;
    
    // Wire events
    document.querySelectorAll('.item-carbs').forEach(input => {
        input.addEventListener('change', updateTotalCarbs);
    });
    
    document.getElementById('editTotalCarbs')?.addEventListener('change', (e) => {
        analysisResult.estimatedCarbs = parseInt(e.target.value) || 0;
    });
    
    document.getElementById('saveMealBtn')?.addEventListener('click', saveMealFromAnalysis);
    document.getElementById('calcDoseBtn')?.addEventListener('click', goToCalculator);
    document.getElementById('retryAnalysisBtn')?.addEventListener('click', resetAnalysis);
}

function updateTotalCarbs() {
    let total = 0;
    document.querySelectorAll('.item-carbs').forEach((input, index) => {
        const carbs = parseInt(input.value) || 0;
        if (analysisResult?.items[index]) {
            analysisResult.items[index].carbs = carbs;
        }
        total += carbs;
    });
    
    analysisResult.estimatedCarbs = total;
    const totalInput = document.getElementById('editTotalCarbs');
    if (totalInput) totalInput.value = total;
}

function saveMealFromAnalysis() {
    if (!analysisResult) return;
    
    const totalCarbs = parseInt(document.getElementById('editTotalCarbs')?.value) || analysisResult.estimatedCarbs;
    
    addEntry('meals', {
        source: 'photo',
        items: analysisResult.items.map(i => ({ name: i.name, carbs: i.carbs })),
        estimatedCarbs: totalCarbs,
        confidence: analysisResult.confidence,
        note: t('AI fotoğraf analizi', 'AI photo analysis')
    });
    
    createToast('success', t('Öğün kaydedildi', 'Meal saved'));
    renderDashboard();
    
    // Reset
    analysisResult = null;
    currentImageData = null;
    renderAnalyzeView();
}

function goToCalculator() {
    if (!analysisResult) return;
    
    const totalCarbs = parseInt(document.getElementById('editTotalCarbs')?.value) || analysisResult.estimatedCarbs;
    
    navigateTo('dose');
    
    setTimeout(() => {
        prefillCarbs(totalCarbs);
    }, 100);
}
