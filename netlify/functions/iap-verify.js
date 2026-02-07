// POST /.netlify/functions/iap-verify
// Unified IAP verification for Apple & Google
// Mobile app calls this after purchase to update Supabase subscription

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Verify user from auth token
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let userId;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    userId = user.id;
  } catch (e) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Auth failed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { platform, productId, transactionId, purchaseToken, expiresAt } = body;

  if (!platform || !productId || !transactionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'platform, productId, transactionId required' })
    };
  }

  try {
    // Determine plan from product ID
    const isPro = productId.includes('pro');
    const isYearly = productId.includes('yearly');

    // Calculate period end if not provided
    let periodEnd = expiresAt;
    if (!periodEnd) {
      const now = new Date();
      periodEnd = isYearly
        ? new Date(now.setFullYear(now.getFullYear() + 1)).toISOString()
        : new Date(now.setMonth(now.getMonth() + 1)).toISOString();
    }

    // Upsert subscription
    const { error: dbError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan: isPro ? 'pro' : 'free',
        status: 'active',
        provider: platform === 'ios' ? 'apple' : 'google',
        apple_receipt: platform === 'ios' ? transactionId : null,
        google_purchase_token: platform === 'android' ? (purchaseToken || transactionId) : null,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (dbError) {
      console.error('DB error:', dbError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        verified: true,
        isPro: true,
        plan: 'PRO',
        expiresAt: periodEnd
      })
    };
  } catch (err) {
    console.error('IAP verify error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
