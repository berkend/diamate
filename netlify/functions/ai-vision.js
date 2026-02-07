// POST /.netlify/functions/ai-vision
// AI Vision endpoint - food photo analysis
// User NEVER sees API key

const { createClient } = require('@supabase/supabase-js');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Vision requires OpenAI (Groq doesn't support vision yet)
const API_KEY = OPENAI_API_KEY || GROQ_API_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';

// Rate limits
const IP_DAILY_LIMIT = 15; // Max vision requests per IP per day
const FREE_VISION_LIMIT = 2;

function getClientIP(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers['x-real-ip']
    || event.headers['client-ip']
    || 'unknown';
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  // Vision requires OpenAI
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY required for vision');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'config_error', message: 'Vision service not configured' }) };
  }

  // === AUTH REQUIRED ===
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'auth_required', message: 'Giriş yapmanız gerekiyor' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const { imageDataUrl, lang = 'tr' } = body;
  if (!imageDataUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_request', message: 'Image required' }) };
  }

  // Check image size (base64 ~1.33x original)
  const maxSize = 1.5 * 1024 * 1024 * 1.33;
  if (imageDataUrl.length > maxSize) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'image_too_large', message: 'Image must be under 1.5MB' }) };
  }

  try {
    // === QUOTA & IP CHECK ===
    let isPro = false;
    let userId = null;
    const clientIP = getClientIP(event);
    const today = new Date().toISOString().split('T')[0];
    const todayStart = today + 'T00:00:00Z';

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Verify user
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (!user || authErr) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'invalid_token', message: 'Geçersiz oturum, tekrar giriş yapın' }) };
      }
      userId = user.id;

      // Check subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', userId)
        .single();

      if (sub && sub.status === 'active' && (!sub.current_period_end || new Date(sub.current_period_end) > new Date())) {
        isPro = sub.plan === 'pro';
      }

      if (!isPro) {
        // 1) Per-user daily limit
        const { count: userCount } = await supabase
          .from('usage_tracking')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('feature', 'vision')
          .gte('used_at', todayStart);

        if ((userCount || 0) >= FREE_VISION_LIMIT) {
          return {
            statusCode: 429, headers,
            body: JSON.stringify({
              error: 'quota_exceeded', code: 'quota_exceeded',
              message: lang === 'en'
                ? `Daily photo analysis limit reached (${FREE_VISION_LIMIT}/day). Upgrade to PRO for unlimited!`
                : `Günlük fotoğraf analizi limitine ulaştınız (${FREE_VISION_LIMIT}/gün). Sınırsız erişim için PRO'ya yükseltin!`
            })
          };
        }

        // 2) Per-IP daily limit (prevents multi-account abuse)
        if (clientIP !== 'unknown') {
          const { count: ipCount } = await supabase
            .from('usage_tracking')
            .select('*', { count: 'exact', head: true })
            .eq('feature', 'vision')
            .eq('ip_address', clientIP)
            .gte('used_at', todayStart);

          if ((ipCount || 0) >= IP_DAILY_LIMIT) {
            return {
              statusCode: 429, headers,
              body: JSON.stringify({
                error: 'ip_rate_limit', code: 'ip_rate_limit',
                message: lang === 'en'
                  ? 'Too many requests from this network today. Try again tomorrow or upgrade to PRO.'
                  : 'Bu ağdan bugün çok fazla istek geldi. Yarın tekrar deneyin veya PRO\'ya yükseltin.'
              })
            };
          }
        }
      }
    }

    const prompt = getVisionPrompt(lang);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } }
          ]
        }],
        max_tokens: 500
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI Vision error:', data);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'ai_error', message: 'Vision service error' }) };
    }

    const aiResponse = data.choices[0].message.content;
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'parse_error', message: 'Could not parse response' }) };
    }

    const result = JSON.parse(jsonMatch[0]);

    // Track usage
    if (userId && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        await supabase.from('usage_tracking').insert({
          user_id: userId,
          feature: 'vision',
          ip_address: getClientIP(event),
          used_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Usage tracking failed:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: result.items || [],
        total_carbs_g: result.total_carbs_g || 0,
        notes: result.notes || '',
        confidence: result.confidence || 'medium'
      })
    };
  } catch (err) {
    console.error('Vision error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'server_error', message: 'Internal server error' }) };
  }
};

function getVisionPrompt(lang) {
  return lang === 'en'
    ? `Analyze this food photo for a diabetes patient. Return ONLY valid JSON:
{"items":[{"name":"food name","portion":"estimated portion","carbs_g":number,"confidence":"high|medium|low"}],"total_carbs_g":number,"notes":"brief note about the meal","confidence":"high|medium|low"}

Be accurate with carbohydrate estimates. If unsure, use medium confidence.`
    : `Bu yemek fotoğrafını bir diyabet hastası için analiz et. SADECE geçerli JSON döndür:
{"items":[{"name":"yemek adı","portion":"tahmini porsiyon","carbs_g":sayı,"confidence":"high|medium|low"}],"total_carbs_g":sayı,"notes":"öğün hakkında kısa not","confidence":"high|medium|low"}

Karbonhidrat tahminlerinde doğru ol. Emin değilsen medium confidence kullan.`;
}
