/**
 * DiaMate Pro - Main Application Entry Point
 * Production-ready MVP with ES Modules
 */

// Core modules
import { initDB, getProfile, setProfile, isSetupComplete, getDB } from './store.js';
import { initRouter, navigateTo, wireNavigation, onRouteChange, getCurrentRoute } from './router.js';
import { SafetyPolicy } from './safety.js';
import { createToast, setLang, getLang, t } from './utils.js';
import { 
    initSupabase, 
    signIn, 
    signUp, 
    signInWithGoogle, 
    signOut, 
    getCurrentUser, 
    getSession,
    saveProfileToCloud,
    loadProfileFromCloud,
    syncToCloud
} from './supabase.js';
import { clearEntitlementCache } from './ai-assistant.js';

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
let currentUser = null;

/**
 * Initialize the application
 */
async function initApp() {
    console.log('DiaMate Pro initializing...');
    
    // Initialize database
    const db = initDB();
    console.log('Database initialized:', db.version);
    
    // Initialize Supabase
    try {
        await initSupabase();
        console.log('Supabase initialized');
        
        // Check for existing session
        const session = await getSession();
        if (session) {
            currentUser = session.user;
            console.log('User logged in:', currentUser.email);
            
            // Load profile from cloud
            const cloudProfile = await loadProfileFromCloud();
            if (cloudProfile) {
                setProfile(cloudProfile);
            }
        }
    } catch (e) {
        console.error('Supabase init error:', e);
    }
    
    // Wire up auth handlers
    wireAuthHandlers();
    
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
    } else if (currentUser) {
        // User is logged in but hasn't completed setup
        navigateTo('setup');
    } else {
        navigateTo('login');
    }
    
    // Wire language switcher
    wireLanguageSwitcher();
    
    // Wire theme switcher (Dark Mode)
    wireThemeSwitcher();
    
    // Listen for auth events
    window.addEventListener('auth:signin', async (e) => {
        currentUser = e.detail?.user;
        console.log('Auth signin event:', currentUser?.email);
        
        // Load profile from cloud
        const cloudProfile = await loadProfileFromCloud();
        if (cloudProfile && cloudProfile.setupComplete) {
            setProfile(cloudProfile);
            navigateTo('dashboard');
            updateHeaderUI();
        } else {
            navigateTo('setup');
        }
    });
    
    window.addEventListener('auth:signout', () => {
        currentUser = null;
        console.log('Auth signout event');
        navigateTo('login');
    });
    
    console.log('DiaMate Pro ready!');
    
    // Check for Stripe checkout success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
        clearEntitlementCache();
        createToast('success', '🎉 ' + t('PRO aboneliğiniz aktif! Tüm özellikler açıldı.', 'Your PRO subscription is active! All features unlocked.'));
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('canceled') === 'true') {
        createToast('info', t('Ödeme iptal edildi', 'Payment canceled'));
        window.history.replaceState({}, '', window.location.pathname);
    }
}

/**
 * Wire authentication handlers
 */
function wireAuthHandlers() {
    const lang = getLang();
    
    // Google Sign In
    const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
    if (btnGoogleSignIn) {
        btnGoogleSignIn.addEventListener('click', async () => {
            try {
                btnGoogleSignIn.disabled = true;
                btnGoogleSignIn.innerHTML = '<span>⏳</span> Yönlendiriliyor...';
                await signInWithGoogle();
            } catch (e) {
                console.error('Google sign in error:', e);
                showAuthError(lang === 'en' ? 'Google sign in failed' : 'Google girişi başarısız');
                btnGoogleSignIn.disabled = false;
                btnGoogleSignIn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg><span>${lang === 'en' ? 'Sign in with Google' : 'Google ile Giriş Yap'}</span>`;
            }
        });
    }
    
    // Email Sign In
    const btnEmailSignIn = document.getElementById('btnEmailSignIn');
    if (btnEmailSignIn) {
        btnEmailSignIn.addEventListener('click', async () => {
            const email = document.getElementById('authEmail')?.value?.trim();
            const password = document.getElementById('authPassword')?.value;
            
            if (!email || !password) {
                showAuthError(lang === 'en' ? 'Please enter email and password' : 'E-posta ve şifre girin');
                return;
            }
            
            try {
                btnEmailSignIn.disabled = true;
                btnEmailSignIn.textContent = '⏳';
                
                const { user } = await signIn(email, password);
                currentUser = user;
                
                // Load profile from cloud
                const cloudProfile = await loadProfileFromCloud();
                if (cloudProfile && cloudProfile.setupComplete) {
                    setProfile(cloudProfile);
                    navigateTo('dashboard');
                    updateHeaderUI();
                } else {
                    navigateTo('setup');
                }
                
                createToast('success', lang === 'en' ? 'Welcome back!' : 'Tekrar hoş geldiniz!');
            } catch (e) {
                console.error('Sign in error:', e);
                showAuthError(e.message || (lang === 'en' ? 'Sign in failed' : 'Giriş başarısız'));
            } finally {
                btnEmailSignIn.disabled = false;
                btnEmailSignIn.textContent = lang === 'en' ? 'Sign In' : 'Giriş Yap';
            }
        });
    }
    
    // Email Sign Up
    const btnEmailSignUp = document.getElementById('btnEmailSignUp');
    if (btnEmailSignUp) {
        btnEmailSignUp.addEventListener('click', async () => {
            const email = document.getElementById('authEmail')?.value?.trim();
            const password = document.getElementById('authPassword')?.value;
            
            if (!email || !password) {
                showAuthError(lang === 'en' ? 'Please enter email and password' : 'E-posta ve şifre girin');
                return;
            }
            
            if (password.length < 6) {
                showAuthError(lang === 'en' ? 'Password must be at least 6 characters' : 'Şifre en az 6 karakter olmalı');
                return;
            }
            
            try {
                btnEmailSignUp.disabled = true;
                btnEmailSignUp.textContent = '⏳';
                
                const { user } = await signUp(email, password);
                
                if (user) {
                    currentUser = user;
                    navigateTo('setup');
                    createToast('success', lang === 'en' ? 'Account created!' : 'Hesap oluşturuldu!');
                } else {
                    showAuthError(lang === 'en' ? 'Please check your email to confirm' : 'E-postanızı kontrol edin');
                }
            } catch (e) {
                console.error('Sign up error:', e);
                showAuthError(e.message || (lang === 'en' ? 'Sign up failed' : 'Kayıt başarısız'));
            } finally {
                btnEmailSignUp.disabled = false;
                btnEmailSignUp.textContent = lang === 'en' ? 'Create Account' : 'Hesap Oluştur';
            }
        });
    }
    
    // Skip Auth (continue without signing in)
    const btnSkipAuth = document.getElementById('btnSkipAuth');
    if (btnSkipAuth) {
        btnSkipAuth.addEventListener('click', () => {
            navigateTo('setup');
        });
    }
}

/**
 * Show auth error message
 */
function showAuthError(message) {
    const errorEl = document.getElementById('authError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    }
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
        btnComplete.addEventListener('click', async () => {
            setProfile({ setupComplete: true });
            
            // Save to cloud if logged in
            if (currentUser) {
                try {
                    const profile = getProfile();
                    await saveProfileToCloud(profile);
                    console.log('Profile saved to cloud');
                } catch (e) {
                    console.error('Error saving profile to cloud:', e);
                }
            }
            
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
 * Wire theme switcher (Dark Mode)
 */
function wireThemeSwitcher() {
    const btnLight = document.getElementById('btnLight');
    const btnDark = document.getElementById('btnDark');
    
    // Load saved theme
    const savedTheme = localStorage.getItem('diamate-theme') || 'light';
    setTheme(savedTheme);
    
    if (btnLight) {
        btnLight.addEventListener('click', () => setTheme('light'));
    }
    
    if (btnDark) {
        btnDark.addEventListener('click', () => setTheme('dark'));
    }
}

/**
 * Set theme (light/dark)
 */
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('diamate-theme', theme);
    
    document.getElementById('btnLight')?.classList.toggle('active', theme === 'light');
    document.getElementById('btnDark')?.classList.toggle('active', theme === 'dark');
    
    // Update meta theme-color for mobile browsers
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', theme === 'dark' ? '#121212' : '#2E7D32');
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
