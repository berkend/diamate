/**
 * DiaMate Pro - Main Application Entry Point
 * Production-ready MVP with ES Modules
 */

// Core modules
import { initDB, getProfile, setProfile, isSetupComplete } from './store.js';
import { initRouter, navigateTo, wireNavigation, onRouteChange, getCurrentRoute } from './router.js';
import { SafetyPolicy } from './safety.js';
import { createToast, setLang, getLang, t } from './utils.js';

// View modules
import { initDashboard, renderDashboard } from './views/dashboard.js';
import { initLog, renderLogView } from './views/log.js';
import { initDose, renderDoseCalculator } from './views/dose.js';
import { initAnalyze, renderAnalyzeView } from './views/analyze.js';
import { initReports, renderReportsView } from './views/reports.js';
import { initProfile, renderProfileView } from './views/profile.js';
import { initChat, renderChatView } from './views/chat.js';

// Global state
let currentLang = 'tr';

/**
 * Initialize the application
 */
function initApp() {
    console.log('DiaMate Pro initializing...');
    
    // Initialize database
    const db = initDB();
    console.log('Database initialized:', db.version);
    
    // Wire up setup and login flows
    wireSetupFlow();
    
    // Wire navigation
    wireNavigation();
    
    // Subscribe to route changes
    onRouteChange(handleRouteChange);
    
    // Initialize router (will navigate to initial route)
    initRouter();
    
    // Check if setup is complete
    const profile = getProfile();
    if (profile.setupComplete) {
        navigateTo('dashboard');
        updateHeaderUI();
    } else {
        navigateTo('login');
    }
    
    // Wire language switcher
    wireLanguageSwitcher();
    
    console.log('DiaMate Pro ready!');
}

/**
 * Handle route changes
 */
function handleRouteChange({ route, subroute }) {
    console.log('Route changed:', route, subroute);
    
    switch (route) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'log':
            renderLogView();
            break;
        case 'dose':
            renderDoseCalculator();
            break;
        case 'analyze':
            renderAnalyzeView();
            break;
        case 'reports':
            renderReportsView();
            break;
        case 'chat':
            renderChatView();
            break;
        case 'profile':
            renderProfileView();
            break;
    }
}

/**
 * Wire setup flow
 */
function wireSetupFlow() {
    let currentStep = 1;
    
    // Start button
    const btnStart = document.getElementById('btnStart');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            navigateTo('setup');
        });
    }
    
    // Step 1 -> Step 2
    const btnStep1Next = document.getElementById('btnStep1Next');
    if (btnStep1Next) {
        btnStep1Next.addEventListener('click', () => {
            const name = document.getElementById('userName')?.value?.trim();
            const age = document.getElementById('userAge')?.value;
            const gender = document.getElementById('userGender')?.value;
            const height = document.getElementById('userHeight')?.value;
            const weight = document.getElementById('userWeight')?.value;
            
            if (!name || !age || !gender || !height || !weight) {
                createToast('warning', 'Lütfen tüm alanları doldurun');
                return;
            }
            
            setProfile({
                name,
                age: parseInt(age),
                gender,
                height: parseInt(height),
                weight: parseInt(weight)
            });
            
            goToStep(2);
        });
    }
    
    // Step 2 -> Step 3
    const btnStep2Next = document.getElementById('btnStep2Next');
    if (btnStep2Next) {
        btnStep2Next.addEventListener('click', () => {
            const diabetesType = document.getElementById('diabetesType')?.value;
            const activityLevel = document.getElementById('activityLevel')?.value;
            const targetRange = document.getElementById('targetRange')?.value;
            
            if (!diabetesType || !activityLevel) {
                createToast('warning', 'Lütfen tüm alanları doldurun');
                return;
            }
            
            // Parse target range
            let targetLow = 70, targetHigh = 140;
            if (targetRange) {
                const parts = targetRange.split('-');
                targetLow = parseInt(parts[0]) || 70;
                targetHigh = parseInt(parts[1]) || 140;
            }
            
            setProfile({
                diabetesType: diabetesType === 'type1' ? 'T1' : diabetesType === 'type2' ? 'T2' : 'Other',
                activityLevel,
                targetLow,
                targetHigh
            });
            
            goToStep(3);
        });
    }
    
    // Step 2 Back
    const btnStep2Back = document.getElementById('btnStep2Back');
    if (btnStep2Back) {
        btnStep2Back.addEventListener('click', () => goToStep(1));
    }
    
    // Step 3 Back
    const btnStep3Back = document.getElementById('btnStep3Back');
    if (btnStep3Back) {
        btnStep3Back.addEventListener('click', () => goToStep(2));
    }
    
    // Complete setup
    const btnComplete = document.getElementById('btnComplete');
    if (btnComplete) {
        btnComplete.addEventListener('click', () => {
            setProfile({ setupComplete: true });
            createToast('success', 'Kurulum tamamlandı!');
            navigateTo('dashboard');
            updateHeaderUI();
        });
    }
    
    // Health app connections (demo)
    wireHealthAppConnections();
    
    function goToStep(step) {
        // Hide current step
        document.getElementById(`step${currentStep}`)?.classList.remove('active');
        document.getElementById(`pStep${currentStep}`)?.classList.remove('active');
        document.getElementById(`pStep${currentStep}`)?.classList.add('done');
        
        if (currentStep < step && currentStep < 3) {
            document.getElementById(`pLine${currentStep}`)?.classList.add('done');
        }
        
        // Show new step
        currentStep = step;
        document.getElementById(`step${step}`)?.classList.add('active');
        document.getElementById(`pStep${step}`)?.classList.add('active');
        document.getElementById(`pStep${step}`)?.classList.remove('done');
    }
}

/**
 * Wire health app connection buttons
 * Shows realistic messages - these require native mobile app
 */
function wireHealthAppConnections() {
    const lang = getLang();
    
    const apps = [
        { card: 'appleCard', status: 'appleStatus', name: 'Apple Health', platform: 'iOS', icon: '🍎' },
        { card: 'googleCard', status: 'googleStatus', name: 'Health Connect', platform: 'Android', icon: '💚' },
        { card: 'samsungCard', status: 'samsungStatus', name: 'Samsung Health', platform: 'Samsung', icon: '💙' },
        { card: 'dexcomCard', status: 'dexcomStatus', name: 'Dexcom CGM', platform: 'iOS/Android', icon: '📟' }
    ];
    
    apps.forEach(app => {
        const card = document.getElementById(app.card);
        if (card) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                // Show info modal/toast instead of alert
                const message = lang === 'en'
                    ? `${app.icon} ${app.name}\n\nThis integration requires the DiaMate mobile app.\n\n✓ Available on ${app.platform}\n✓ Coming soon to App Store & Google Play`
                    : `${app.icon} ${app.name}\n\nBu entegrasyon DiaMate mobil uygulaması gerektirir.\n\n✓ ${app.platform} için mevcut\n✓ Yakında App Store & Google Play'de`;
                
                createToast('info', lang === 'en' 
                    ? `${app.name}: Mobile app required` 
                    : `${app.name}: Mobil uygulama gerekli`);
            });
        }
    });
}

/**
 * Update header UI with user info
 */
function updateHeaderUI() {
    const profile = getProfile();
    const lang = getLang();
    
    // Update greeting based on language
    const hour = new Date().getHours();
    let greeting;
    if (lang === 'en') {
        greeting = 'Good morning';
        if (hour >= 12 && hour < 18) greeting = 'Good afternoon';
        else if (hour >= 18) greeting = 'Good evening';
    } else {
        greeting = 'Günaydın';
        if (hour >= 12 && hour < 18) greeting = 'İyi günler';
        else if (hour >= 18) greeting = 'İyi akşamlar';
    }
    
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) greetingEl.textContent = greeting;
    
    // Update name
    const headerName = document.getElementById('headerName');
    if (headerName && profile.name) {
        headerName.textContent = profile.name.split(' ')[0];
    }
    
    // Update avatar
    const headerAvatar = document.getElementById('headerAvatar');
    if (headerAvatar) {
        headerAvatar.textContent = profile.gender === 'male' ? '👨' : profile.gender === 'female' ? '👩' : '👤';
    }
    
    // Update BMI
    if (profile.height && profile.weight) {
        const bmi = (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1);
        const bmiValue = document.getElementById('bmiValue');
        if (bmiValue) bmiValue.textContent = bmi;
        
        const bmiCategory = document.getElementById('bmiCategory');
        if (bmiCategory) {
            let category = 'Normal';
            let color = 'var(--success)';
            
            if (bmi < 18.5) { category = 'Zayıf'; color = 'var(--info)'; }
            else if (bmi >= 25 && bmi < 30) { category = 'Fazla Kilolu'; color = 'var(--warning)'; }
            else if (bmi >= 30) { category = 'Obez'; color = 'var(--error)'; }
            
            bmiCategory.textContent = category;
            bmiCategory.style.color = color;
            bmiCategory.style.background = `${color}15`;
            if (bmiValue) bmiValue.style.color = color;
        }
    }
}

/**
 * Wire language switcher
 */
function wireLanguageSwitcher() {
    const btnTR = document.getElementById('btnTR');
    const btnEN = document.getElementById('btnEN');
    
    if (btnTR) {
        btnTR.addEventListener('click', () => setLanguage('tr'));
    }
    
    if (btnEN) {
        btnEN.addEventListener('click', () => setLanguage('en'));
    }
}

/**
 * Set language and re-render current view
 */
function setLanguage(lang) {
    currentLang = lang;
    setLang(lang); // Update utils.js language state
    
    document.getElementById('btnTR')?.classList.toggle('active', lang === 'tr');
    document.getElementById('btnEN')?.classList.toggle('active', lang === 'en');
    
    // Update data-tr/data-en elements
    document.querySelectorAll('[data-tr][data-en]').forEach(el => {
        el.textContent = el.getAttribute(`data-${lang}`);
    });
    
    // Update header greeting
    updateHeaderUI();
    
    // Re-render current view to apply language changes
    const route = getCurrentRoute();
    if (route) {
        handleRouteChange(route);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Export for debugging
window.DiaMate = {
    getProfile,
    setProfile,
    navigateTo,
    renderDashboard,
    SafetyPolicy
};
