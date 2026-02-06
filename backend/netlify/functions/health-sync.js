// POST /.netlify/functions/health-sync
// Sync data from mobile health platforms (HealthKit, Health Connect, Samsung Health)
// Called by mobile app after reading from native health APIs

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { checkRateLimit } = require('./lib/quotas');
const { supabaseAdmin } = require('./lib/supabase');

// Valid sources from mobile platforms
const VALID_SOURCES = ['apple_health', 'health_connect', 'samsung_health'];

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse();
    }

    if (event.httpMethod !== 'POST') {
        return errorResponse(405, 'method_not_allowed', 'Only POST allowed');
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

    const { action, platform, readings, settings } = body;

    if (!action) {
        return errorResponse(400, 'invalid_request', 'action required');
    }

    try {
        switch (action) {
            case 'update_settings':
                return await handleUpdateSettings(userId, platform, settings);
            
            case 'sync_readings':
                return await handleSyncReadings(userId, platform, readings);
            
            case 'get_settings':
                return await handleGetSettings(userId);
            
            case 'delete_imported':
                return await handleDeleteImported(userId, platform);
            
            default:
                return errorResponse(400, 'invalid_action', 'Unknown action');
        }
    } catch (err) {
        console.error('Health sync error:', err);
        return errorResponse(500, 'server_error', err.message);
    }
};

/**
 * Update health platform connection settings
 */
async function handleUpdateSettings(userId, platform, settings) {
    if (!platform || !VALID_SOURCES.includes(platform)) {
        return errorResponse(400, 'invalid_platform', 'Valid platform required');
    }

    const { readEnabled, writeEnabled, grantedTypes, syncEnabled } = settings || {};

    const connectionData = {
        user_id: userId,
        platform,
        read_enabled: readEnabled ?? false,
        write_enabled: writeEnabled ?? false,
        granted_types: grantedTypes || [],
        sync_enabled: syncEnabled ?? true,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
        .from('health_connections')
        .upsert(connectionData, { onConflict: 'user_id,platform' });

    if (error) {
        return errorResponse(500, 'db_error', 'Could not update settings');
    }

    return successResponse({ success: true, settings: connectionData });
}

/**
 * Sync glucose readings from mobile health platform
 */
async function handleSyncReadings(userId, platform, readings) {
    if (!platform || !VALID_SOURCES.includes(platform)) {
        return errorResponse(400, 'invalid_platform', 'Valid platform required');
    }

    if (!readings || !Array.isArray(readings)) {
        return errorResponse(400, 'invalid_readings', 'readings array required');
    }

    // Check if sync is enabled for this platform
    const { data: connection } = await supabaseAdmin
        .from('health_connections')
        .select('read_enabled, sync_enabled')
        .eq('user_id', userId)
        .eq('platform', platform)
        .single();

    if (!connection?.read_enabled || !connection?.sync_enabled) {
        return errorResponse(403, 'sync_disabled', 'Sync not enabled for this platform');
    }

    // Validate and normalize readings
    const validReadings = readings
        .filter(r => r.timestamp && r.mgdl && r.mgdl > 0 && r.mgdl < 1000)
        .map(r => ({
            user_id: userId,
            timestamp: r.timestamp,
            mgdl: Math.round(r.mgdl),
            source: platform,
            source_id: r.sourceId || `${platform}_${r.timestamp}_${r.mgdl}`,
            trend: r.trend || null,
            device: r.device || null,
            context: r.context || null,
            notes: r.notes || null,
            imported_at: new Date().toISOString()
        }));

    if (validReadings.length === 0) {
        return successResponse({ success: true, syncedCount: 0 });
    }

    // Upsert readings (ignore duplicates)
    const { error } = await supabaseAdmin
        .from('glucose_readings')
        .upsert(validReadings, {
            onConflict: 'user_id,source,source_id',
            ignoreDuplicates: true
        });

    if (error) {
        console.error('Sync error:', error);
        return errorResponse(500, 'db_error', 'Could not save readings');
    }

    // Update last sync time
    await supabaseAdmin
        .from('health_connections')
        .update({ 
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('platform', platform);

    return successResponse({ 
        success: true, 
        syncedCount: validReadings.length,
        platform
    });
}

/**
 * Get all health connection settings
 */
async function handleGetSettings(userId) {
    const { data: connections, error } = await supabaseAdmin
        .from('health_connections')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        return errorResponse(500, 'db_error', 'Could not fetch settings');
    }

    // Also get CGM connectors
    const { data: cgmConnectors } = await supabaseAdmin
        .from('cgm_connectors')
        .select('vendor, status, last_sync_at, device_info')
        .eq('user_id', userId);

    return successResponse({
        healthPlatforms: connections || [],
        cgmConnectors: cgmConnectors || []
    });
}

/**
 * Delete all imported data from a platform
 */
async function handleDeleteImported(userId, platform) {
    if (!platform) {
        return errorResponse(400, 'invalid_platform', 'platform required');
    }

    // Delete readings from this source
    const { error: deleteError, count } = await supabaseAdmin
        .from('glucose_readings')
        .delete()
        .eq('user_id', userId)
        .eq('source', platform);

    if (deleteError) {
        return errorResponse(500, 'db_error', 'Could not delete data');
    }

    // If it's a CGM, also disconnect
    if (['dexcom', 'libre', 'medtronic'].includes(platform)) {
        await supabaseAdmin
            .from('cgm_connectors')
            .update({ 
                status: 'disconnected',
                access_token: null,
                refresh_token: null
            })
            .eq('user_id', userId)
            .eq('vendor', platform);
    }

    // If it's a health platform, reset connection
    if (VALID_SOURCES.includes(platform)) {
        await supabaseAdmin
            .from('health_connections')
            .update({
                read_enabled: false,
                write_enabled: false,
                granted_types: [],
                last_sync_at: null
            })
            .eq('user_id', userId)
            .eq('platform', platform);
    }

    return successResponse({ 
        success: true, 
        deletedCount: count || 0,
        message: `Deleted data from ${platform}`
    });
}
