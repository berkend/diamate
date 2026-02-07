// GET /.netlify/functions/entitlement
// Returns user entitlement based on Supabase subscription
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PLANS = {
  free: {
    chatPerDay: 5,
    visionPerDay: 2,
    pdfExport: false,
    doctorShare: false,
    cloudSync: false,
    reminders: 2
  },
  pro: {
    chatPerDay: 999,
    visionPerDay: 999,
    pdfExport: true,
    doctorShare: true,
    cloudSync: true,
    reminders: 999
  }
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, max-age=0'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const today = new Date().toISOString().split('T')[0];
  const todayStart = new Date(today + 'T00:00:00Z').toISOString();

  // Try to get user from auth header
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  let plan = 'free';
  let userId = null;
  let dailyChatCount = 0;
  let dailyVisionCount = 0;

  if (token && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Verify user
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (user && !authError) {
        userId = user.id;

        // Check subscription
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('plan, status, current_period_end')
          .eq('user_id', userId)
          .single();

        if (sub && sub.status === 'active') {
          // Check if subscription is still valid
          if (!sub.current_period_end || new Date(sub.current_period_end) > new Date()) {
            plan = sub.plan || 'free';
          }
        }

        // Count today's usage
        const { count: chatCount } = await supabase
          .from('usage_tracking')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('feature', 'chat')
          .gte('used_at', todayStart);

        const { count: visionCount } = await supabase
          .from('usage_tracking')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('feature', 'vision')
          .gte('used_at', todayStart);

        dailyChatCount = chatCount || 0;
        dailyVisionCount = visionCount || 0;
      }
    } catch (e) {
      console.error('Entitlement check error:', e);
    }
  }

  const quotas = PLANS[plan] || PLANS.free;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      isPro: plan === 'pro',
      plan: plan.toUpperCase(),
      quotas,
      usage: {
        dailyChatCount,
        dailyVisionCount,
        lastResetDate: today
      }
    })
  };
};
