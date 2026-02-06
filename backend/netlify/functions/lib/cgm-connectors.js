// CGM Connector Interface & Implementations
const { supabaseAdmin } = require('./supabase');

// ============================================
// ABSTRACT CONNECTOR INTERFACE
// ============================================

class CGMConnector {
    constructor(userId, vendor) {
        this.userId = userId;
        this.vendor = vendor;
    }

    // Must be implemented by subclasses
    async getAuthUrl(redirectUri) { throw new Error('Not implemented'); }
    async exchangeCode(code, redirectUri) { throw new Error('Not implemented'); }
    async refreshToken() { throw new Error('Not implemented'); }
    async syncGlucose(startDate, endDate) { throw new Error('Not implemented'); }
    async disconnect() {
        await supabaseAdmin
            .from('cgm_connectors')
            .update({ 
                status: 'disconnected',
                access_token: null,
                refresh_token: null,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', this.userId)
            .eq('vendor', this.vendor);
        return { success: true };
    }
}

// ============================================
// DEXCOM CONNECTOR (OAuth 2.0)
// ============================================

const DEXCOM_CONFIG = {
    clientId: process.env.DEXCOM_CLIENT_ID,
    clientSecret: process.env.DEXCOM_CLIENT_SECRET,
    // Use sandbox for development, api for production
    baseUrl: process.env.DEXCOM_ENV === 'production' 
        ? 'https://api.dexcom.com' 
        : 'https://sandbox-api.dexcom.com',
    authUrl: process.env.DEXCOM_ENV === 'production'
        ? 'https://api.dexcom.com/v2/oauth2'
        : 'https://sandbox-api.dexcom.com/v2/oauth2',
    scopes: ['offline_access', 'egvs', 'calibrations', 'devices', 'events']
};

class DexcomConnector extends CGMConnector {
    constructor(userId) {
        super(userId, 'dexcom');
    }

    async getAuthUrl(redirectUri) {
        const params = new URLSearchParams({
            client_id: DEXCOM_CONFIG.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: DEXCOM_CONFIG.scopes.join(' '),
            state: this.userId // Use userId as state for verification
        });
        return `${DEXCOM_CONFIG.authUrl}/login?${params.toString()}`;
    }

    async exchangeCode(code, redirectUri) {
        const response = await fetch(`${DEXCOM_CONFIG.authUrl}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: DEXCOM_CONFIG.clientId,
                client_secret: DEXCOM_CONFIG.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error_description || 'Token exchange failed');
        }

        const tokens = await response.json();
        
        // Save to database
        await supabaseAdmin
            .from('cgm_connectors')
            .upsert({
                user_id: this.userId,
                vendor: 'dexcom',
                status: 'connected',
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                scopes: DEXCOM_CONFIG.scopes,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,vendor' });

        return { success: true };
    }

    async refreshToken() {
        // Get current refresh token
        const { data: connector } = await supabaseAdmin
            .from('cgm_connectors')
            .select('refresh_token')
            .eq('user_id', this.userId)
            .eq('vendor', 'dexcom')
            .single();

        if (!connector?.refresh_token) {
            throw new Error('No refresh token available');
        }

        const response = await fetch(`${DEXCOM_CONFIG.authUrl}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: DEXCOM_CONFIG.clientId,
                client_secret: DEXCOM_CONFIG.clientSecret,
                refresh_token: connector.refresh_token,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            // Mark as expired
            await supabaseAdmin
                .from('cgm_connectors')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('user_id', this.userId)
                .eq('vendor', 'dexcom');
            throw new Error('Token refresh failed');
        }

        const tokens = await response.json();

        await supabaseAdmin
            .from('cgm_connectors')
            .update({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || connector.refresh_token,
                token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                status: 'connected',
                updated_at: new Date().toISOString()
            })
            .eq('user_id', this.userId)
            .eq('vendor', 'dexcom');

        return tokens.access_token;
    }

    async getAccessToken() {
        const { data: connector } = await supabaseAdmin
            .from('cgm_connectors')
            .select('access_token, token_expires_at')
            .eq('user_id', this.userId)
            .eq('vendor', 'dexcom')
            .single();

        if (!connector) {
            throw new Error('Not connected');
        }

        // Check if token is expired (with 5 min buffer)
        const expiresAt = new Date(connector.token_expires_at);
        if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
            return await this.refreshToken();
        }

        return connector.access_token;
    }

    async syncGlucose(startDate, endDate) {
        const accessToken = await this.getAccessToken();
        
        // Format dates for Dexcom API
        const start = new Date(startDate).toISOString();
        const end = new Date(endDate).toISOString();

        const response = await fetch(
            `${DEXCOM_CONFIG.baseUrl}/v3/users/self/egvs?startDate=${start}&endDate=${end}`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                // Try refresh and retry once
                const newToken = await this.refreshToken();
                const retryResponse = await fetch(
                    `${DEXCOM_CONFIG.baseUrl}/v3/users/self/egvs?startDate=${start}&endDate=${end}`,
                    { headers: { 'Authorization': `Bearer ${newToken}` } }
                );
                if (!retryResponse.ok) throw new Error('Sync failed after token refresh');
                return this.processEGVResponse(await retryResponse.json());
            }
            throw new Error('Failed to fetch glucose data');
        }

        return this.processEGVResponse(await response.json());
    }

    processEGVResponse(data) {
        const readings = (data.egvs || data.records || []).map(egv => ({
            timestamp: egv.systemTime || egv.displayTime,
            mgdl: egv.value,
            source: 'dexcom',
            source_id: egv.recordId || `${egv.systemTime}_${egv.value}`,
            trend: this.normalizeTrend(egv.trend || egv.trendRate),
            trend_arrow: egv.trend,
            device: 'Dexcom CGM'
        }));

        return readings;
    }

    normalizeTrend(trend) {
        const trendMap = {
            'doubleUp': 'rising_fast',
            'singleUp': 'rising',
            'fortyFiveUp': 'rising',
            'flat': 'stable',
            'fortyFiveDown': 'falling',
            'singleDown': 'falling',
            'doubleDown': 'falling_fast'
        };
        return trendMap[trend] || null;
    }
}

// ============================================
// CONNECTOR FACTORY
// ============================================

function getConnector(userId, vendor) {
    switch (vendor) {
        case 'dexcom':
            return new DexcomConnector(userId);
        // Future: case 'libre': return new LibreConnector(userId);
        default:
            throw new Error(`Unknown vendor: ${vendor}`);
    }
}

async function listConnectors(userId) {
    const { data, error } = await supabaseAdmin
        .from('cgm_connectors')
        .select('vendor, status, last_sync_at, scopes, device_info')
        .eq('user_id', userId);

    if (error) throw error;

    // Add available connectors that aren't connected
    const connected = new Set(data.map(c => c.vendor));
    const available = ['dexcom', 'libre', 'medtronic'].filter(v => !connected.has(v));

    return {
        connected: data,
        available: available.map(v => ({ vendor: v, status: 'available' }))
    };
}

module.exports = {
    CGMConnector,
    DexcomConnector,
    getConnector,
    listConnectors
};
