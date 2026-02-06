/**
 * DiaMate Router - Single Page Application routing
 */

let currentRoute = null;
let currentSubroute = null;
let routeChangeCallbacks = [];

// Route to screen mapping
const routeScreenMap = {
    'setup': 'setupScreen',
    'login': 'loginScreen',
    'dashboard': 'dashboardScreen',
    'log': 'glucoseScreen',
    'analyze': 'photoScreen',
    'dose': 'doseScreen',
    'reports': 'reportsScreen',
    'chat': 'chatScreen',
    'profile': 'profileScreen'
};

// Nav button to route mapping
const navRouteMap = {
    'navHome': 'dashboard',
    'navGlucose': 'log',
    'navChat': 'chat',
    'navReports': 'reports',
    'navProfile': 'profile'
};

// Route to nav button mapping (reverse)
const routeNavMap = {
    'dashboard': 'navHome',
    'log': 'navGlucose',
    'analyze': 'navGlucose',
    'chat': 'navChat',
    'reports': 'navReports',
    'profile': 'navProfile'
};

/**
 * Initialize router
 */
export function initRouter() {
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.route) {
            navigateTo(e.state.route, e.state.subroute, false);
        }
    });
    
    // Set initial state
    const initialRoute = getInitialRoute();
    navigateTo(initialRoute, null, true);
}

/**
 * Get initial route based on app state
 */
function getInitialRoute() {
    // Check URL hash first
    const hash = window.location.hash.slice(1);
    if (hash && routeScreenMap[hash]) {
        return hash;
    }
    return 'login';
}

/**
 * Navigate to route
 */
export function navigateTo(route, subroute = null, pushState = true) {
    const [mainRoute, sub] = route.includes(':') ? route.split(':') : [route, subroute];
    
    // Validate route
    if (!routeScreenMap[mainRoute]) {
        console.error('Invalid route:', mainRoute);
        return;
    }
    
    // Hide all screens
    hideAllScreens();
    
    // Show target screen
    const screenId = routeScreenMap[mainRoute];
    const screen = document.getElementById(screenId);
    
    if (screen) {
        screen.classList.add('active');
        
        // Handle main app container
        const mainApp = document.getElementById('mainApp');
        const loginScreen = document.getElementById('loginScreen');
        const setupScreen = document.getElementById('setupScreen');
        
        if (mainRoute === 'login') {
            if (loginScreen) loginScreen.classList.add('active');
            if (mainApp) mainApp.classList.remove('active');
            if (setupScreen) setupScreen.classList.remove('active');
        } else if (mainRoute === 'setup') {
            if (setupScreen) setupScreen.classList.add('active');
            if (mainApp) mainApp.classList.remove('active');
            if (loginScreen) loginScreen.classList.remove('active');
        } else {
            if (mainApp) mainApp.classList.add('active');
            if (loginScreen) loginScreen.classList.remove('active');
            if (setupScreen) setupScreen.classList.remove('active');
        }
    }
    
    // Update nav state
    updateNavState(mainRoute);
    
    // Update state
    const previousRoute = currentRoute;
    const previousSubroute = currentSubroute;
    currentRoute = mainRoute;
    currentSubroute = sub;
    
    // Push to history
    if (pushState) {
        const state = { route: mainRoute, subroute: sub };
        const url = `#${mainRoute}${sub ? ':' + sub : ''}`;
        history.pushState(state, '', url);
    }
    
    // Notify callbacks
    routeChangeCallbacks.forEach(cb => {
        cb({
            route: mainRoute,
            subroute: sub,
            previousRoute,
            previousSubroute
        });
    });
}

/**
 * Hide all screens
 */
function hideAllScreens() {
    // Hide main screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Also handle the main containers
    const mainApp = document.getElementById('mainApp');
    const loginScreen = document.getElementById('loginScreen');
    const setupScreen = document.getElementById('setupScreen');
    
    // Don't remove active from mainApp here, handle it in navigateTo
}

/**
 * Update navigation state
 */
function updateNavState(route) {
    // Remove active from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
    });
    
    // Add active to current route's nav button
    const navId = routeNavMap[route];
    if (navId) {
        const navBtn = document.getElementById(navId);
        if (navBtn) {
            navBtn.classList.add('active');
            navBtn.style.color = 'var(--primary)';
        }
    }
}

/**
 * Get current route info
 */
export function getCurrentRoute() {
    return { route: currentRoute, subroute: currentSubroute };
}

/**
 * Get current subroute
 */
export function getCurrentSubroute() {
    return currentSubroute;
}

/**
 * Subscribe to route changes
 */
export function onRouteChange(callback) {
    routeChangeCallbacks.push(callback);
    return () => {
        routeChangeCallbacks = routeChangeCallbacks.filter(cb => cb !== callback);
    };
}

/**
 * Go back
 */
export function goBack() {
    history.back();
}

/**
 * Wire navigation buttons
 */
export function wireNavigation() {
    // Bottom nav buttons
    Object.entries(navRouteMap).forEach(([navId, route]) => {
        const btn = document.getElementById(navId);
        if (btn) {
            btn.addEventListener('click', () => navigateTo(route));
        }
    });
    
    // Quick action buttons
    const quickActions = {
        'btnQuickGlucose': () => navigateTo('log', 'add-glucose'),
        'btnQuickMeal': () => navigateTo('log', 'add-meal'),
        'btnQuickDose': () => navigateTo('dose'),
        'btnQuickPhoto': () => navigateTo('analyze')
    };
    
    Object.entries(quickActions).forEach(([btnId, handler]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', handler);
        }
    });
}
