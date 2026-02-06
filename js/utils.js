/**
 * DiaMate Utilities
 */

// Current language state
let currentLang = 'tr';

/**
 * Get current language
 */
export function getLang() {
    return currentLang;
}

/**
 * Set current language
 */
export function setLang(lang) {
    currentLang = lang;
}

/**
 * Get translated text
 */
export function t(tr, en) {
    return currentLang === 'en' ? en : tr;
}

/**
 * Generate UUID
 */
export function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Format relative time
 */
export function formatRelativeTime(ts) {
    const now = Date.now();
    const diff = now - ts;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return t('Şimdi', 'Just now');
    if (minutes < 60) return t(`${minutes}dk önce`, `${minutes}m ago`);
    if (hours < 24) return t(`${hours}sa önce`, `${hours}h ago`);
    if (days < 7) return t(`${days}g önce`, `${days}d ago`);
    
    return formatDateTime(ts);
}

/**
 * Format date time
 */
export function formatDateTime(ts) {
    const date = new Date(ts);
    const locale = currentLang === 'en' ? 'en-US' : 'tr-TR';
    return date.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format date only
 */
export function formatDate(ts) {
    const date = new Date(ts);
    const locale = currentLang === 'en' ? 'en-US' : 'tr-TR';
    return date.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Format time only
 */
export function formatTime(ts) {
    const date = new Date(ts);
    const locale = currentLang === 'en' ? 'en-US' : 'tr-TR';
    return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Round to increment
 */
export function roundToIncrement(value, increment) {
    return Math.round(value / increment) * increment;
}

/**
 * Calculate mean
 */
export function mean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function stdDev(values) {
    if (!values || values.length < 2) return 0;
    const avg = mean(values);
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(mean(squareDiffs));
}

/**
 * Get start of day timestamp
 */
export function startOfDay(ts = Date.now()) {
    const date = new Date(ts);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * Get days ago timestamp
 */
export function daysAgo(days) {
    return Date.now() - (days * 24 * 60 * 60 * 1000);
}

// Toast container
let toastContainer = null;

/**
 * Create toast notification
 */
export function createToast(type, message, duration = 3000) {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 90%;
            width: 360px;
        `;
        document.body.appendChild(toastContainer);
    }
    
    const colors = {
        success: { bg: '#E8F5E9', border: '#4CAF50', text: '#2E7D32', icon: '✓' },
        error: { bg: '#FFEBEE', border: '#F44336', text: '#C62828', icon: '✕' },
        warning: { bg: '#FFF3E0', border: '#FF9800', text: '#E65100', icon: '⚠' },
        info: { bg: '#E3F2FD', border: '#2196F3', text: '#1565C0', icon: 'ℹ' }
    };
    
    const style = colors[type] || colors.info;
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${style.bg};
        border: 2px solid ${style.border};
        border-radius: 12px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        animation: slideDown 0.3s ease;
    `;
    
    toast.innerHTML = `
        <span style="font-size: 18px; color: ${style.border};">${style.icon}</span>
        <span style="flex: 1; font-size: 14px; font-weight: 600; color: ${style.text};">${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Add toast animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideUp {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }
`;
document.head.appendChild(style);

/**
 * Show confirmation dialog
 */
export function showConfirm(title, message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    overlay.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 24px; max-width: 340px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div style="font-size: 18px; font-weight: 700; color: #1A1A2E; margin-bottom: 12px;">${title}</div>
            <div style="font-size: 14px; color: #6B7280; margin-bottom: 24px; line-height: 1.5;">${message}</div>
            <div style="display: flex; gap: 12px;">
                <button id="confirmCancel" style="flex: 1; padding: 14px; border: 2px solid #E5E7EB; background: white; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer;">${t('İptal', 'Cancel')}</button>
                <button id="confirmOk" style="flex: 1; padding: 14px; border: none; background: linear-gradient(135deg, #F44336 0%, #E53935 100%); color: white; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer;">${t('Onayla', 'Confirm')}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.querySelector('#confirmCancel').onclick = () => {
        overlay.remove();
        if (onCancel) onCancel();
    };
    
    overlay.querySelector('#confirmOk').onclick = () => {
        overlay.remove();
        if (onConfirm) onConfirm();
    };
    
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
            if (onCancel) onCancel();
        }
    };
}

/**
 * Validate numeric input
 */
export function validateNumeric(value, min = 0, max = Infinity) {
    const num = parseFloat(value);
    if (isNaN(num)) return { valid: false, error: t('Geçerli bir sayı girin', 'Enter a valid number') };
    if (num < min) return { valid: false, error: t(`Minimum değer: ${min}`, `Minimum value: ${min}`) };
    if (num > max) return { valid: false, error: t(`Maksimum değer: ${max}`, `Maximum value: ${max}`) };
    return { valid: true, value: num };
}

/**
 * Show inline error
 */
export function showInputError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    input.style.borderColor = '#F44336';
    
    let errorEl = input.parentElement.querySelector('.input-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'input-error';
        errorEl.style.cssText = 'color: #F44336; font-size: 12px; margin-top: 4px; font-weight: 500;';
        input.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
}

/**
 * Clear inline error
 */
export function clearInputError(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    input.style.borderColor = '';
    
    const errorEl = input.parentElement.querySelector('.input-error');
    if (errorEl) errorEl.remove();
}

/**
 * Clear all input errors
 */
export function clearAllInputErrors() {
    document.querySelectorAll('.input-error').forEach(el => el.remove());
    document.querySelectorAll('input, select').forEach(el => el.style.borderColor = '');
}
