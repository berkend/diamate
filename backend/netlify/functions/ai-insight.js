// POST /.netlify/functions/ai-insight
// Event-driven AI insights (PRO only)

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { checkQuota, incrementUsage, checkRateLimit } = require('./lib/quotas');
const { getSafetySystemPrompt } = require('./lib/ai-safety');
const { supabaseAdmin } = require('./lib/supabase');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Throttle: minimum minutes between same trigger type
const THROTTLE_MINUTES = {
    hypo: 30,
    hyper: 60,
    meal: 15,
    pattern: 120,
    manual: 5
};

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

    const quotaCheck = await checkQuota(userId, 'insight');
    if (!quotaCheck.allowed) {
        const statusCode = quotaCheck.code === 'subscription_required' ? 402 : 429;
        return errorResponse(statusCode, quotaCheck.code, quotaCheck.error);
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return errorResponse(400, 'invalid_json', 'Invalid JSON body');
    }

    const { triggerType, triggerData, lang = 'tr' } = body;

    if (!triggerType || !triggerData) {
        return errorResponse(400, 'invalid_request', 'triggerType and triggerData required');
    }

    // Check throttle
    const throttleCheck = await checkThrottle(userId, triggerType);
    if (!throttleCheck.allowed) {
        return successResponse({
            skipped: true,
            reason: 'throttled',
            nextAvailableAt: throttleCheck.nextAvailableAt
        });
    }

    try {
        // Get user context
        const context = await getUserContext(userId);
        
        // Build insight prompt
        const prompt = buildInsightPrompt(triggerType, triggerData, context, lang);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    { role: 'system', content: getInsightSystemPrompt(lang) + getSafetySystemPrompt() },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('OpenAI error:', data);
            return errorResponse(500, 'ai_error', 'AI service error');
        }

        const insight = data.choices[0].message.content;

        // Update throttle
        await updateThrottle(userId, triggerType);

        // Increment usage
        await incrementUsage(userId, 'insight');

        return successResponse({
            insight,
            triggerType,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('AI Insight error:', err);
        return errorResponse(500, 'server_error', 'Internal server error');
    }
};


/**
 * Check if trigger is throttled
 */
async function checkThrottle(userId, triggerType) {
    const { data, error } = await supabaseAdmin
        .from('insight_throttle')
        .select('last_triggered_at')
        .eq('user_id', userId)
        .eq('trigger_type', triggerType)
        .single();

    if (error || !data) {
        return { allowed: true };
    }

    const lastTriggered = new Date(data.last_triggered_at);
    const throttleMs = (THROTTLE_MINUTES[triggerType] || 30) * 60 * 1000;
    const nextAvailable = new Date(lastTriggered.getTime() + throttleMs);

    if (Date.now() < nextAvailable.getTime()) {
        return { allowed: false, nextAvailableAt: nextAvailable.toISOString() };
    }

    return { allowed: true };
}

/**
 * Update throttle timestamp
 */
async function updateThrottle(userId, triggerType) {
    await supabaseAdmin
        .from('insight_throttle')
        .upsert({
            user_id: userId,
            trigger_type: triggerType,
            last_triggered_at: new Date().toISOString()
        }, { onConflict: 'user_id,trigger_type' });
}

/**
 * Get user context for insights
 */
async function getUserContext(userId) {
    const { data: profile } = await supabaseAdmin
        .from('profile_facts')
        .select('facts')
        .eq('user_id', userId)
        .single();

    return {
        facts: profile?.facts || {},
        diabetes: profile?.facts?.diabetes || {}
    };
}

/**
 * Build insight prompt based on trigger type
 */
function buildInsightPrompt(triggerType, triggerData, context, lang) {
    const diabetes = context.diabetes;
    const units = diabetes.units || 'mg/dL';
    const targets = diabetes.targets || {};

    const prompts = {
        hypo: {
            tr: `Kullanıcı düşük kan şekeri (hipoglisemi) yaşıyor.
Mevcut değer: ${triggerData.value} ${units}
Hedef aralık: ${targets.rangeLow || 80}-${targets.rangeHigh || 180} ${units}
Hipo eşiği: ${targets.hypoThreshold || 70} ${units}
${triggerData.recentMeal ? `Son öğün: ${triggerData.recentMeal}` : ''}
${triggerData.recentInsulin ? `Son insülin: ${triggerData.recentInsulin}` : ''}

Kısa ve destekleyici bir mesaj ver. Acil adımları hatırlat (15-20g hızlı karbonhidrat). Panik yaratma.`,
            en: `User is experiencing low blood sugar (hypoglycemia).
Current value: ${triggerData.value} ${units}
Target range: ${targets.rangeLow || 80}-${targets.rangeHigh || 180} ${units}
Hypo threshold: ${targets.hypoThreshold || 70} ${units}
${triggerData.recentMeal ? `Recent meal: ${triggerData.recentMeal}` : ''}
${triggerData.recentInsulin ? `Recent insulin: ${triggerData.recentInsulin}` : ''}

Give a short, supportive message. Remind immediate steps (15-20g fast carbs). Don't cause panic.`
        },
        hyper: {
            tr: `Kullanıcı yüksek kan şekeri (hiperglisemi) yaşıyor.
Mevcut değer: ${triggerData.value} ${units}
Hedef aralık: ${targets.rangeLow || 80}-${targets.rangeHigh || 180} ${units}
Hiper eşiği: ${targets.hyperThreshold || 250} ${units}

Kısa ve sakin bir mesaj ver. Su içmeyi, hareket etmeyi öner. Çok yüksekse keton kontrolü hatırlat. Doz hesaplayıcıya yönlendir.`,
            en: `User is experiencing high blood sugar (hyperglycemia).
Current value: ${triggerData.value} ${units}
Target range: ${targets.rangeLow || 80}-${targets.rangeHigh || 180} ${units}
Hyper threshold: ${targets.hyperThreshold || 250} ${units}

Give a short, calm message. Suggest hydration and movement. If very high, remind ketone check. Direct to dose calculator.`
        },
        meal: {
            tr: `Kullanıcı yemek kaydetti.
Öğün: ${triggerData.mealType || 'Bilinmiyor'}
Karbonhidrat: ${triggerData.carbs || 0}g
${triggerData.foods ? `Yiyecekler: ${triggerData.foods}` : ''}
${triggerData.preMealBG ? `Yemek öncesi KŞ: ${triggerData.preMealBG} ${units}` : ''}

Kısa bir yorum yap. Karbonhidrat miktarına göre tavsiye ver. Doz hesaplayıcıyı hatırlat.`,
            en: `User logged a meal.
Meal: ${triggerData.mealType || 'Unknown'}
Carbs: ${triggerData.carbs || 0}g
${triggerData.foods ? `Foods: ${triggerData.foods}` : ''}
${triggerData.preMealBG ? `Pre-meal BG: ${triggerData.preMealBG} ${units}` : ''}

Give a brief comment. Advise based on carb amount. Remind about dose calculator.`
        },
        pattern: {
            tr: `Kullanıcının son 7 günlük verileri analiz edildi.
Ortalama KŞ: ${triggerData.avgBG || 'N/A'} ${units}
Hedefte kalma: ${triggerData.timeInRange || 'N/A'}%
Hipo sayısı: ${triggerData.hypoCount || 0}
Hiper sayısı: ${triggerData.hyperCount || 0}
${triggerData.patterns ? `Tespit edilen paternler: ${triggerData.patterns}` : ''}

Kısa bir özet ve 1-2 pratik öneri ver.`,
            en: `User's last 7 days data analyzed.
Average BG: ${triggerData.avgBG || 'N/A'} ${units}
Time in range: ${triggerData.timeInRange || 'N/A'}%
Hypo count: ${triggerData.hypoCount || 0}
Hyper count: ${triggerData.hyperCount || 0}
${triggerData.patterns ? `Detected patterns: ${triggerData.patterns}` : ''}

Give a brief summary and 1-2 practical suggestions.`
        },
        manual: {
            tr: `Kullanıcı şu konuda insight istiyor: ${triggerData.topic || 'genel'}
${triggerData.context ? `Ek bilgi: ${triggerData.context}` : ''}

Kısa ve yararlı bir yanıt ver.`,
            en: `User wants insight about: ${triggerData.topic || 'general'}
${triggerData.context ? `Additional info: ${triggerData.context}` : ''}

Give a short and helpful response.`
        }
    };

    const promptSet = prompts[triggerType] || prompts.manual;
    return promptSet[lang] || promptSet.tr;
}

/**
 * Get system prompt for insights
 */
function getInsightSystemPrompt(lang) {
    if (lang === 'en') {
        return `You are DiaMate AI providing quick, contextual insights for diabetes management.

Rules:
- Keep responses SHORT (2-3 sentences max)
- Be supportive and calm
- Use 1-2 relevant emojis
- Never give specific insulin doses
- For dose questions, redirect to the dose calculator
- Be actionable - give practical next steps`;
    }

    return `Sen DiaMate AI, diyabet yönetimi için hızlı, bağlamsal içgörüler sunuyorsun.

Kurallar:
- Yanıtları KISA tut (maksimum 2-3 cümle)
- Destekleyici ve sakin ol
- 1-2 ilgili emoji kullan
- Asla spesifik insülin dozu verme
- Doz soruları için doz hesaplayıcıya yönlendir
- Uygulanabilir ol - pratik sonraki adımlar ver`;
}
