// GET /.netlify/functions/health-summary
// Get health summary for AI context and reports

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { supabaseAdmin } = require('./lib/supabase');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse();
    }

    if (event.httpMethod !== 'GET') {
        return errorResponse(405, 'method_not_allowed', 'Only GET allowed');
    }

    const { userId, error: authError } = await verifyAuth(event.headers.authorization);
    if (authError) {
        return errorResponse(401, 'unauthorized', authError);
    }

    const params = event.queryStringParameters || {};
    const days = parseInt(params.days) || 7;
    const includeReadings = params.includeReadings === 'true';

    try {
        // Get summary from database function
        const { data: summary, error: summaryError } = await supabaseAdmin
            .rpc('get_health_summary', { p_user_id: userId });

        if (summaryError) {
            console.error('Summary error:', summaryError);
        }

        // Get profile facts for AI context
        const { data: profile } = await supabaseAdmin
            .from('profile_facts')
            .select('facts')
            .eq('user_id', userId)
            .single();

        // Get AI memory if enabled
        const { data: memory } = await supabaseAdmin
            .from('ai_memory')
            .select('summary_text, is_enabled')
            .eq('user_id', userId)
            .single();

        // Check if AI personalization is enabled
        const permissions = profile?.facts?.permissions || {};
        const aiEnabled = permissions.aiPersonalizationEnabled !== false;

        // Build response
        const response = {
            summary: summary || null,
            profile: aiEnabled ? {
                diabetes: profile?.facts?.diabetes || {},
                preferences: profile?.facts?.preferences || {}
            } : null,
            aiMemory: (aiEnabled && memory?.is_enabled) ? memory.summary_text : null
        };

        // Optionally include recent readings
        if (includeReadings) {
            const startTs = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
            
            const { data: readings } = await supabaseAdmin
                .rpc('get_glucose_readings', {
                    p_user_id: userId,
                    p_start_ts: startTs,
                    p_end_ts: new Date().toISOString()
                });

            response.readings = readings || [];
        }

        return successResponse(response);

    } catch (err) {
        console.error('Health summary error:', err);
        return errorResponse(500, 'server_error', err.message);
    }
};
