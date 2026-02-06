// Auth verification helper
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('./supabase');

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

/**
 * Verify JWT token and return user ID
 * @param {string} authHeader - Authorization header
 * @returns {Promise<{userId: string, error: string|null}>}
 */
async function verifyAuth(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { userId: null, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        // Verify JWT
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.sub;

        if (!userId) {
            return { userId: null, error: 'Invalid token: no user ID' };
        }

        // Verify user exists in database
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return { userId: null, error: 'User not found' };
        }

        return { userId, error: null };
    } catch (err) {
        console.error('Auth verification error:', err.message);
        return { userId: null, error: 'Invalid or expired token' };
    }
}

/**
 * Standard error response
 */
function errorResponse(statusCode, code, message) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({ error: code, message })
    };
}

/**
 * Standard success response
 */
function successResponse(data) {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify(data)
    };
}

/**
 * CORS preflight response
 */
function corsResponse() {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: ''
    };
}

module.exports = { verifyAuth, errorResponse, successResponse, corsResponse };
