// POST /.netlify/functions/ai-memory-update
// Update AI memory and profile facts

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { checkRateLimit } = require('./lib/quotas');
const { supabaseAdmin } = require('./lib/supabase');

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

    const { action, data } = body;

    if (!action) {
        return errorResponse(400, 'invalid_request', 'action required');
    }

    try {
        switch (action) {
            case 'updateProfileFacts':
                return await handleUpdateProfileFacts(userId, data);
            
            case 'updateMemory':
                return await handleUpdateMemory(userId, data);
            
            case 'clearMemory':
                return await handleClearMemory(userId);
            
            case 'togglePersonalization':
                return await handleTogglePersonalization(userId, data);
            
            case 'deleteAllData':
                return await handleDeleteAllData(userId);
            
            default:
                return errorResponse(400, 'invalid_action', 'Unknown action');
        }
    } catch (err) {
        console.error('Memory update error:', err);
        return errorResponse(500, 'server_error', 'Internal server error');
    }
};

async function handleUpdateProfileFacts(userId, data) {
    if (!data || typeof data !== 'object') {
        return errorResponse(400, 'invalid_data', 'Profile facts data required');
    }

    // Get current facts
    const { data: current, error: fetchError } = await supabaseAdmin
        .from('profile_facts')
        .select('facts')
        .eq('user_id', userId)
        .single();

    if (fetchError) {
        return errorResponse(500, 'db_error', 'Could not fetch profile');
    }

    // Deep merge new data with existing
    const mergedFacts = deepMerge(current.facts || {}, data);
    mergedFacts.version = (mergedFacts.version || 1) + 1;

    const { error: updateError } = await supabaseAdmin
        .from('profile_facts')
        .update({ facts: mergedFacts, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

    if (updateError) {
        return errorResponse(500, 'db_error', 'Could not update profile');
    }

    return successResponse({ success: true, facts: mergedFacts });
}


async function handleUpdateMemory(userId, data) {
    if (!data || typeof data.summary !== 'string') {
        return errorResponse(400, 'invalid_data', 'Memory summary string required');
    }

    // Limit summary length
    const summary = data.summary.slice(0, 2000);

    const { error } = await supabaseAdmin
        .from('ai_memory')
        .update({ 
            summary_text: summary, 
            updated_at: new Date().toISOString() 
        })
        .eq('user_id', userId);

    if (error) {
        return errorResponse(500, 'db_error', 'Could not update memory');
    }

    return successResponse({ success: true });
}

async function handleClearMemory(userId) {
    const { error } = await supabaseAdmin
        .from('ai_memory')
        .update({ 
            summary_text: '', 
            updated_at: new Date().toISOString() 
        })
        .eq('user_id', userId);

    if (error) {
        return errorResponse(500, 'db_error', 'Could not clear memory');
    }

    return successResponse({ success: true, message: 'AI memory cleared' });
}

async function handleTogglePersonalization(userId, data) {
    if (typeof data?.enabled !== 'boolean') {
        return errorResponse(400, 'invalid_data', 'enabled boolean required');
    }

    // Get current facts
    const { data: current, error: fetchError } = await supabaseAdmin
        .from('profile_facts')
        .select('facts')
        .eq('user_id', userId)
        .single();

    if (fetchError) {
        return errorResponse(500, 'db_error', 'Could not fetch profile');
    }

    const facts = current.facts || {};
    facts.permissions = facts.permissions || {};
    facts.permissions.aiPersonalizationEnabled = data.enabled;

    const { error: updateError } = await supabaseAdmin
        .from('profile_facts')
        .update({ facts, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

    if (updateError) {
        return errorResponse(500, 'db_error', 'Could not update settings');
    }

    // If disabling, also disable AI memory
    if (!data.enabled) {
        await supabaseAdmin
            .from('ai_memory')
            .update({ is_enabled: false })
            .eq('user_id', userId);
    }

    return successResponse({ 
        success: true, 
        aiPersonalizationEnabled: data.enabled 
    });
}

async function handleDeleteAllData(userId) {
    // KVKK/GDPR compliance - delete all user data
    // Note: This will cascade delete due to foreign key constraints
    
    const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

    if (error) {
        console.error('Delete error:', error);
        return errorResponse(500, 'db_error', 'Could not delete data');
    }

    return successResponse({ 
        success: true, 
        message: 'All data deleted. Account will be deactivated.' 
    });
}

/**
 * Deep merge utility
 */
function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}
