// POST/GET /.netlify/functions/cgm-connect
// CGM Connection management - OAuth flow, sync, disconnect

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { checkRateLimit } = require('./lib/quotas');
const { getConnector, listConnectors } = require('./lib/cgm-connectors');
const { supabaseAdmin } = require('./lib/supabase');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse();
    }

    // GET - list connectors or get auth URL
    if (event.httpMethod === 'GET') {
        const { userId, error: authError } = await verifyAuth(event.headers.authorization);
        if (authError) {
            return errorResponse(401, 'unauthorized', authError);
        }

        const params = event.queryStringParameters || {};
        
        // Get OAuth URL for a vendor
        if (params.action === 'auth_url' && params.vendor) {
            try {
                const connector = getConnector(userId, params.vendor);
                const redirectUri = params.redirect_uri || `${process.env.APP_URL}/cgm-callback`;
                const authUrl = await connector.getAuthUrl(redirectUri);
                return successResponse({ authUrl });
            } catch (err) {
                return errorResponse(400, 'invalid_vendor', err.message);
            }
        }

        // List all connectors
        try {
            const connectors = await listConnectors(userId);
            return successResponse(connectors);
        } catch (err) {
            return errorResponse(500, 'server_error', err.message);
        }
    }

    if (event.httpMethod !== 'POST') {
        return errorResponse(405, 'method_not_allowed', 'Only GET/POST allowed');
    }

    const { userId, error: authError } = await verifyAuth(event.headers.authorization);
    if (authError) {
        return errorResponse(401, 'unauthorized', authError);
    }

    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
        return errorResponse(429, rateCheck.code, rateCheck.error);
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return errorResponse(400, 'invalid_json', 'Invalid JSON body');
    }

    const { action, vendor, code, redirectUri, startDate, endDate } = body;

    if (!action || !vendor) {
        return errorResponse(400, 'invalid_request', 'action and vendor required');
    }

    try {
        const connector = getConnector(userId, vendor);

        switch (action) {
            case 'exchange_code':
                // Complete OAuth flow
                if (!code) {
                    return errorResponse(400, 'invalid_request', 'code required');
                }
                await connector.exchangeCode(code, redirectUri);
                return successResponse({ success: true, message: 'Connected successfully' });

            case 'sync':
                // Sync glucose data
                const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const end = endDate || new Date().toISOString();
                
                const readings = await connector.syncGlucose(start, end);
                
                // Save readings to database
                if (readings.length > 0) {
                    const toInsert = readings.map(r => ({
                        user_id: userId,
                        timestamp: r.timestamp,
                        mgdl: r.mgdl,
                        source: r.source,
                        source_id: r.source_id,
                        trend: r.trend,
                        trend_arrow: r.trend_arrow,
                        device: r.device
                    }));

                    // Upsert to handle duplicates
                    await supabaseAdmin
                        .from('glucose_readings')
                        .upsert(toInsert, { 
                            onConflict: 'user_id,source,source_id',
                            ignoreDuplicates: true 
                        });

                    // Update last sync time
                    await supabaseAdmin
                        .from('cgm_connectors')
                        .update({ 
                            last_sync_at: new Date().toISOString(),
                            last_sync_status: 'success',
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId)
                        .eq('vendor', vendor);
                }

                return successResponse({ 
                    success: true, 
                    syncedCount: readings.length,
                    period: { start, end }
                });

            case 'disconnect':
                await connector.disconnect();
                return successResponse({ success: true, message: 'Disconnected' });

            default:
                return errorResponse(400, 'invalid_action', 'Unknown action');
        }
    } catch (err) {
        console.error('CGM Connect error:', err);
        return errorResponse(500, 'server_error', err.message);
    }
};
