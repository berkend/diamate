// GET/POST /.netlify/functions/entitlement
// Returns user entitlement (PRO status, quotas)
// In production, this would check Supabase for subscription status

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

  // In production, extract user from JWT and check Supabase
  // const authHeader = event.headers.authorization;
  // const user = await verifyToken(authHeader);
  // const subscription = await getSubscription(user.id);

  // For now, return FREE tier
  // In production, this would check the database
  const today = new Date().toISOString().split('T')[0];
  
  const entitlement = {
    isPro: false,
    plan: 'FREE',
    quotas: {
      chatPerDay: 5,
      visionPerDay: 0,
      insightsPerWeek: 3
    },
    usage: {
      dailyChatCount: 0,
      dailyVisionCount: 0,
      lastResetDate: today
    }
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(entitlement)
  };
};
