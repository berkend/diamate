// POST /.netlify/functions/iap-google-verify
// Verify Android Google Play purchases

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { supabaseAdmin } = require('./lib/supabase');
const { google } = require('googleapis');

// Google Play credentials (from env)
const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT_JSON; // Base64 encoded JSON
const GOOGLE_PACKAGE_NAME = process.env.GOOGLE_PACKAGE_NAME || 'com.diamate.app';

// Product IDs
const PRO_PRODUCT_IDS = ['com.diamate.pro.monthly', 'com.diamate.pro.yearly'];

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

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return errorResponse(400, 'invalid_json', 'Invalid JSON body');
    }

    const { purchaseToken, productId, subscriptionId } = body;

    if (!purchaseToken || !subscriptionId) {
        return errorResponse(400, 'invalid_request', 'purchaseToken and subscriptionId required');
    }

    // Verify it's a known product
    if (!PRO_PRODUCT_IDS.includes(subscriptionId)) {
        return errorResponse(400, 'invalid_product', 'Unknown subscription ID');
    }

    try {
        // Initialize Google API client
        const credentials = JSON.parse(
            Buffer.from(GOOGLE_SERVICE_ACCOUNT, 'base64').toString('utf8')
        );

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/androidpublisher']
        });

        const androidPublisher = google.androidpublisher({ version: 'v3', auth });

        // Get subscription details
        const response = await androidPublisher.purchases.subscriptions.get({
            packageName: GOOGLE_PACKAGE_NAME,
            subscriptionId: subscriptionId,
            token: purchaseToken
        });

        const subscription = response.data;

        // Check subscription status
        // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = deferred
        // acknowledgementState: 0 = not acknowledged, 1 = acknowledged
        const isActive = subscription.expiryTimeMillis > Date.now();
        const isPending = subscription.paymentState === 0;
        const isCanceled = subscription.cancelReason !== undefined;

        // Determine status
        let status = 'active';
        if (!isActive) {
            status = 'expired';
        } else if (isPending) {
            status = 'pending';
        } else if (isCanceled) {
            status = 'canceled';
        } else if (subscription.paymentState === 3) {
            status = 'grace'; // Deferred payment
        }

        // Update subscription in database
        const subscriptionData = {
            user_id: userId,
            platform: 'android',
            status,
            plan: isActive ? 'PRO' : 'FREE',
            product_id: subscriptionId,
            external_id: subscription.orderId,
            original_transaction_id: subscription.linkedPurchaseToken || purchaseToken,
            current_period_start: new Date(parseInt(subscription.startTimeMillis)).toISOString(),
            current_period_end: new Date(parseInt(subscription.expiryTimeMillis)).toISOString(),
            cancel_at_period_end: isCanceled,
            updated_at: new Date().toISOString()
        };

        const { error: dbError } = await supabaseAdmin
            .from('subscriptions')
            .upsert(subscriptionData, { onConflict: 'user_id,platform' });

        if (dbError) {
            console.error('DB error:', dbError);
            return errorResponse(500, 'db_error', 'Could not update subscription');
        }

        // Acknowledge the purchase if not already acknowledged
        if (subscription.acknowledgementState === 0) {
            try {
                await androidPublisher.purchases.subscriptions.acknowledge({
                    packageName: GOOGLE_PACKAGE_NAME,
                    subscriptionId: subscriptionId,
                    token: purchaseToken
                });
            } catch (ackError) {
                console.error('Acknowledge error:', ackError);
                // Don't fail the request, just log
            }
        }

        return successResponse({
            verified: true,
            isActive,
            plan: isActive ? 'PRO' : 'FREE',
            status,
            expiresAt: new Date(parseInt(subscription.expiryTimeMillis)).toISOString(),
            productId: subscriptionId,
            willRenew: !isCanceled && subscription.autoRenewing
        });

    } catch (err) {
        console.error('Google verification error:', err);
        
        // Handle specific Google API errors
        if (err.code === 404) {
            return errorResponse(400, 'purchase_not_found', 'Purchase not found');
        }
        if (err.code === 401 || err.code === 403) {
            return errorResponse(500, 'auth_error', 'Google API authentication failed');
        }
        
        return errorResponse(500, 'server_error', 'Verification failed');
    }
};
