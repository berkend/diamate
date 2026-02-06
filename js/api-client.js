// DiaMate API Client - Backend Integration
// Handles all communication with Netlify Functions backend

const API_BASE = window.DIAMATE_API_URL || '/.netlify/functions';

class DiaMateAPI {
    constructor() {
        this.token = null;
        this.entitlement = null;
    }

    // ==========================================
    // AUTH
    // ==========================================
    
    setToken(token) {
        this.token = token;
        localStorage.setItem('diamate_token', token);
    }

    getToken() {
        if (!this.token) {
            this.token = localStorage.getItem('diamate_token');
        }
        return this.token;
    }

    clearToken() {
        this.token = null;
        this.entitlement = null;
        localStorage.removeItem('diamate_token');
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    // ==========================================
    // HTTP HELPERS
    // ==========================================

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const token = this.getToken();

        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new APIError(data.error || 'request_failed', data.message || 'Request failed', response.status);
            }

            return data;
        } catch (err) {
            if (err instanceof APIError) throw err;
            throw new APIError('network_error', err.message, 0);
        }
    }

    // ==========================================
    // ENTITLEMENT
    // ==========================================

    async getEntitlement(forceRefresh = false) {
        if (this.entitlement && !forceRefresh) {
            return this.entitlement;
        }

        try {
            this.entitlement = await this.request('/entitlement');
            return this.entitlement;
        } catch (err) {
            console.error('Entitlement error:', err);
            // Return default FREE entitlement on error
            return {
                isPro: false,
                plan: 'FREE',
                quotas: { chatPerDay: 5, chatPerMonth: 0, visionPerMonth: 0 },
                usage: { chatCount: 0, dailyChatCount: 0, visionCount: 0 }
            };
        }
    }

    isPro() {
        return this.entitlement?.isPro || false;
    }

    // ==========================================
    // AI CHAT
    // ==========================================

    async chat(messages, options = {}) {
        const { lang = 'tr', recentContext } = options;

        return this.request('/ai-chat', {
            method: 'POST',
            body: JSON.stringify({ messages, lang, recentContext })
        });
    }

    // ==========================================
    // AI VISION (Photo Analysis)
    // ==========================================

    async analyzePhoto(imageDataUrl, lang = 'tr') {
        return this.request('/ai-vision', {
            method: 'POST',
            body: JSON.stringify({ imageDataUrl, lang })
        });
    }

    // ==========================================
    // AI INSIGHTS
    // ==========================================

    async getInsight(triggerType, triggerData, lang = 'tr') {
        return this.request('/ai-insight', {
            method: 'POST',
            body: JSON.stringify({ triggerType, triggerData, lang })
        });
    }

    // ==========================================
    // WEEKLY SUMMARY
    // ==========================================

    async getWeeklySummary(weekData, lang = 'tr') {
        return this.request('/weekly-summary-cron', {
            method: 'POST',
            body: JSON.stringify({ mode: 'user', lang, weekData })
        });
    }

    // ==========================================
    // PROFILE & MEMORY
    // ==========================================

    async updateProfileFacts(facts) {
        return this.request('/ai-memory-update', {
            method: 'POST',
            body: JSON.stringify({ action: 'updateProfileFacts', data: facts })
        });
    }

    async updateMemory(summary) {
        return this.request('/ai-memory-update', {
            method: 'POST',
            body: JSON.stringify({ action: 'updateMemory', data: { summary } })
        });
    }

    async clearMemory() {
        return this.request('/ai-memory-update', {
            method: 'POST',
            body: JSON.stringify({ action: 'clearMemory' })
        });
    }

    async togglePersonalization(enabled) {
        return this.request('/ai-memory-update', {
            method: 'POST',
            body: JSON.stringify({ action: 'togglePersonalization', data: { enabled } })
        });
    }

    async deleteAllData() {
        return this.request('/ai-memory-update', {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteAllData' })
        });
    }

    // ==========================================
    // IN-APP PURCHASES
    // ==========================================

    async verifyApplePurchase(transactionId, originalTransactionId) {
        return this.request('/iap-apple-verify', {
            method: 'POST',
            body: JSON.stringify({ transactionId, originalTransactionId })
        });
    }

    async verifyGooglePurchase(purchaseToken, subscriptionId) {
        return this.request('/iap-google-verify', {
            method: 'POST',
            body: JSON.stringify({ purchaseToken, subscriptionId })
        });
    }

    // ==========================================
    // HEALTH INTEGRATIONS
    // ==========================================

    async getHealthSettings() {
        return this.request('/health-sync', {
            method: 'POST',
            body: JSON.stringify({ action: 'get_settings' })
        });
    }

    async updateHealthSettings(platform, settings) {
        return this.request('/health-sync', {
            method: 'POST',
            body: JSON.stringify({ action: 'update_settings', platform, settings })
        });
    }

    async syncHealthReadings(platform, readings) {
        return this.request('/health-sync', {
            method: 'POST',
            body: JSON.stringify({ action: 'sync_readings', platform, readings })
        });
    }

    async deleteHealthData(platform) {
        return this.request('/health-sync', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_imported', platform })
        });
    }

    async getHealthSummary(days = 7, includeReadings = false) {
        return this.request(`/health-summary?days=${days}&includeReadings=${includeReadings}`);
    }

    // ==========================================
    // CGM CONNECTORS
    // ==========================================

    async listCGMConnectors() {
        return this.request('/cgm-connect');
    }

    async getCGMAuthUrl(vendor, redirectUri) {
        const params = new URLSearchParams({ action: 'auth_url', vendor });
        if (redirectUri) params.append('redirect_uri', redirectUri);
        return this.request(`/cgm-connect?${params.toString()}`);
    }

    async completeCGMAuth(vendor, code, redirectUri) {
        return this.request('/cgm-connect', {
            method: 'POST',
            body: JSON.stringify({ action: 'exchange_code', vendor, code, redirectUri })
        });
    }

    async syncCGM(vendor, days = 1) {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        return this.request('/cgm-connect', {
            method: 'POST',
            body: JSON.stringify({ action: 'sync', vendor, startDate })
        });
    }

    async disconnectCGM(vendor) {
        return this.request('/cgm-connect', {
            method: 'POST',
            body: JSON.stringify({ action: 'disconnect', vendor })
        });
    }
}

// Custom error class
class APIError extends Error {
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'APIError';
    }

    isQuotaExceeded() {
        return this.code === 'quota_exceeded';
    }

    isSubscriptionRequired() {
        return this.code === 'subscription_required';
    }

    isRateLimited() {
        return this.code === 'rate_limited';
    }

    isUnauthorized() {
        return this.status === 401;
    }
}

// Singleton instance
const api = new DiaMateAPI();

export { api, DiaMateAPI, APIError };
