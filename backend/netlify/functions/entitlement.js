// POST /.netlify/functions/entitlement
// Returns user's subscription status, quotas, and usage

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { getEntitlement } = require('./lib/quotas');

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse();
    }

    if (event.httpMethod !== 'POST') {
        return errorResponse(405, 'method_not_allowed', 'Only POST allowed');
    }

    // Verify authentication
    const { userId, error: authError } = await verifyAuth(event.headers.authorization);
    if (authError) {
        return errorResponse(401, 'unauthorized', authError);
    }

    try {
        const entitlement = await getEntitlement(userId);

        if (!entitlement) {
            return errorResponse(500, 'entitlement_error', 'Could not fetch entitlement');
        }

        return successResponse({
            isPro: entitlement.isPro,
            plan: entitlement.plan,
            status: entitlement.status,
            platform: entitlement.platform,
            currentPeriodEnd: entitlement.currentPeriodEnd,
            quotas: entitlement.quotas,
            usage: entitlement.usage,
            aiPersonalizationEnabled: entitlement.aiPersonalizationEnabled
        });

    } catch (err) {
        console.error('Entitlement error:', err);
        return errorResponse(500, 'server_error', 'Internal server error');
    }
};
