// POST /.netlify/functions/iap-apple-verify
// Verify iOS App Store purchases using StoreKit 2 / App Store Server API

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { supabaseAdmin } = require('./lib/supabase');
const jwt = require('jsonwebtoken');

// Apple App Store Connect credentials (from env)
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_ISSUER_ID = process.env.APPLE_ISSUER_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY; // Base64 encoded
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.diamate.app';
const APPLE_ENVIRONMENT = process.env.APPLE_ENVIRONMENT || 'Sandbox'; // 'Production' or 'Sandbox'

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

    const { transactionId, originalTransactionId } = body;

    if (!transactionId) {
        return errorResponse(400, 'invalid_request', 'transactionId required');
    }

    try {
        // Generate App Store Server API JWT
        const appStoreToken = generateAppStoreJWT();

        // Get transaction info from App Store Server API
        const baseUrl = APPLE_ENVIRONMENT === 'Production' 
            ? 'https://api.storekit.itunes.apple.com'
            : 'https://api.storekit-sandbox.itunes.apple.com';

        const response = await fetch(
            `${baseUrl}/inApps/v1/transactions/${transactionId}`,
            {
                headers: {
                    'Authorization': `Bearer ${appStoreToken}`
                }
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Apple API error:', response.status, errorData);
            return errorResponse(400, 'verification_failed', 'Could not verify purchase');
        }

        const data = await response.json();
        
        // Decode the signed transaction
        const transactionInfo = decodeSignedTransaction(data.signedTransactionInfo);
        
        if (!transactionInfo) {
            return errorResponse(400, 'invalid_transaction', 'Could not decode transaction');
        }

        // Verify bundle ID
        if (transactionInfo.bundleId !== APPLE_BUNDLE_ID) {
            return errorResponse(400, 'invalid_bundle', 'Bundle ID mismatch');
        }

        // Check if it's a PRO product
        if (!PRO_PRODUCT_IDS.includes(transactionInfo.productId)) {
            return errorResponse(400, 'invalid_product', 'Unknown product ID');
        }

        // Determine subscription status
        const now = Date.now();
        const expiresDate = transactionInfo.expiresDate;
        const isActive = expiresDate > now;

        // Update subscription in database
        const subscriptionData = {
            user_id: userId,
            platform: 'ios',
            status: isActive ? 'active' : 'expired',
            plan: isActive ? 'PRO' : 'FREE',
            product_id: transactionInfo.productId,
            external_id: transactionId,
            original_transaction_id: transactionInfo.originalTransactionId || originalTransactionId,
            current_period_start: new Date(transactionInfo.purchaseDate).toISOString(),
            current_period_end: new Date(expiresDate).toISOString(),
            cancel_at_period_end: transactionInfo.autoRenewStatus === 0,
            updated_at: new Date().toISOString()
        };

        const { error: dbError } = await supabaseAdmin
            .from('subscriptions')
            .upsert(subscriptionData, { onConflict: 'user_id,platform' });

        if (dbError) {
            console.error('DB error:', dbError);
            return errorResponse(500, 'db_error', 'Could not update subscription');
        }

        return successResponse({
            verified: true,
            isActive,
            plan: isActive ? 'PRO' : 'FREE',
            expiresAt: new Date(expiresDate).toISOString(),
            productId: transactionInfo.productId,
            willRenew: transactionInfo.autoRenewStatus === 1
        });

    } catch (err) {
        console.error('Apple verification error:', err);
        return errorResponse(500, 'server_error', 'Verification failed');
    }
};

/**
 * Generate JWT for App Store Server API
 */
function generateAppStoreJWT() {
    const privateKey = Buffer.from(APPLE_PRIVATE_KEY, 'base64').toString('utf8');
    
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
        iss: APPLE_ISSUER_ID,
        iat: now,
        exp: now + 3600, // 1 hour
        aud: 'appstoreconnect-v1',
        bid: APPLE_BUNDLE_ID
    };

    return jwt.sign(payload, privateKey, {
        algorithm: 'ES256',
        header: {
            alg: 'ES256',
            kid: APPLE_KEY_ID,
            typ: 'JWT'
        }
    });
}

/**
 * Decode signed transaction from Apple
 * Note: In production, you should verify the signature
 */
function decodeSignedTransaction(signedTransaction) {
    if (!signedTransaction) return null;
    
    try {
        // JWS format: header.payload.signature
        const parts = signedTransaction.split('.');
        if (parts.length !== 3) return null;
        
        const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf8')
        );
        
        return payload;
    } catch (err) {
        console.error('Decode error:', err);
        return null;
    }
}
