// POST /.netlify/functions/weekly-summary-cron
// Scheduled weekly summary generation (called by Netlify scheduled function or external cron)
// Also can be triggered manually by user

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { checkQuota, incrementUsage } = require('./lib/quotas');
const { getSafetySystemPrompt } = require('./lib/ai-safety');
const { supabaseAdmin } = require('./lib/supabase');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const CRON_SECRET = process.env.CRON_SECRET;

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse();
    }

    if (event.httpMethod !== 'POST') {
        return errorResponse(405, 'method_not_allowed', 'Only POST allowed');
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        body = {};
    }

    const { mode = 'user', cronSecret } = body;

    // Two modes: 'cron' (batch all PRO users) or 'user' (single user request)
    if (mode === 'cron') {
        // Verify cron secret
        if (cronSecret !== CRON_SECRET) {
            return errorResponse(401, 'unauthorized', 'Invalid cron secret');
        }
        return await handleCronBatch();
    } else {
        // User-triggered summary
        const { userId, error: authError } = await verifyAuth(event.headers.authorization);
        if (authError) {
            return errorResponse(401, 'unauthorized', authError);
        }
        return await handleUserSummary(userId, body.lang || 'tr', body.weekData);
    }
};

/**
 * Handle cron batch - generate summaries for all eligible PRO users
 */
async function handleCronBatch() {
    try {
        // Get all PRO users who haven't exceeded weekly quota
        const monthKey = new Date().toISOString().slice(0, 7);
        
        const { data: proUsers, error } = await supabaseAdmin
            .from('subscriptions')
            .select('user_id')
            .eq('plan', 'PRO')
            .in('status', ['active', 'grace']);

        if (error) {
            console.error('DB error:', error);
            return errorResponse(500, 'db_error', 'Could not fetch users');
        }

        let processed = 0;
        let skipped = 0;

        for (const sub of proUsers || []) {
            // Check quota
            const { data: usage } = await supabaseAdmin
                .from('usage')
                .select('weekly_count')
                .eq('user_id', sub.user_id)
                .eq('month_key', monthKey)
                .single();

            if ((usage?.weekly_count || 0) >= 4) {
                skipped++;
                continue;
            }

            // Generate summary (fire and forget for batch)
            generateWeeklySummary(sub.user_id).catch(err => {
                console.error(`Summary error for ${sub.user_id}:`, err);
            });
            
            processed++;
        }

        return successResponse({
            message: 'Batch started',
            processed,
            skipped
        });

    } catch (err) {
        console.error('Cron batch error:', err);
        return errorResponse(500, 'server_error', 'Batch processing failed');
    }
}


/**
 * Handle single user summary request
 */
async function handleUserSummary(userId, lang, weekData) {
    // Quota check
    const quotaCheck = await checkQuota(userId, 'weekly');
    if (!quotaCheck.allowed) {
        const statusCode = quotaCheck.code === 'subscription_required' ? 402 : 429;
        return {
            statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: quotaCheck.error, code: quotaCheck.code })
        };
    }

    try {
        const summary = await generateWeeklySummary(userId, lang, weekData);
        return successResponse(summary);
    } catch (err) {
        console.error('User summary error:', err);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Could not generate summary', code: 'server_error' })
        };
    }
}

/**
 * Generate weekly summary for a user
 */
async function generateWeeklySummary(userId, lang = 'tr', providedData = null) {
    // Get user profile
    const { data: profile } = await supabaseAdmin
        .from('profile_facts')
        .select('facts')
        .eq('user_id', userId)
        .single();

    const facts = profile?.facts || {};
    const diabetes = facts.diabetes || {};
    const units = diabetes.units || 'mg/dL';
    const targets = diabetes.targets || {};

    // Use provided data or placeholder (in real app, fetch from glucose logs)
    const weekData = providedData || {
        avgBG: 145,
        timeInRange: 68,
        hypoCount: 3,
        hyperCount: 5,
        totalReadings: 42,
        mealsLogged: 18,
        bestDay: 'Salı',
        worstDay: 'Cumartesi',
        patterns: []
    };

    const prompt = buildWeeklyPrompt(weekData, diabetes, lang);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
                { role: 'system', content: getWeeklySystemPrompt(lang) + getSafetySystemPrompt() },
                { role: 'user', content: prompt }
            ],
            max_tokens: 800,
            temperature: 0.7
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error('OpenAI API error');
    }

    const summaryText = data.choices[0].message.content;

    // Increment usage
    await incrementUsage(userId, 'weekly');

    return {
        summary: summaryText,
        stats: weekData,
        generatedAt: new Date().toISOString(),
        weekOf: getWeekRange()
    };
}

function buildWeeklyPrompt(data, diabetes, lang) {
    const units = diabetes.units || 'mg/dL';
    const targets = diabetes.targets || {};

    if (lang === 'en') {
        return `Generate a weekly diabetes management summary based on this data:

Stats:
- Average BG: ${data.avgBG} ${units}
- Time in Range (${targets.rangeLow || 80}-${targets.rangeHigh || 180}): ${data.timeInRange}%
- Hypo events (<${targets.hypoThreshold || 70}): ${data.hypoCount}
- Hyper events (>${targets.hyperThreshold || 250}): ${data.hyperCount}
- Total readings: ${data.totalReadings}
- Meals logged: ${data.mealsLogged}
- Best day: ${data.bestDay}
- Most challenging day: ${data.worstDay}

Create a supportive, personalized weekly summary with:
1. Overall assessment (1-2 sentences)
2. Wins/positives from the week
3. Areas for improvement
4. 2-3 specific, actionable tips for next week
5. Motivational closing

Keep it warm and encouraging. Use emojis sparingly.`;
    }

    return `Bu verilere göre haftalık diyabet yönetim özeti oluştur:

İstatistikler:
- Ortalama KŞ: ${data.avgBG} ${units}
- Hedefte Kalma (${targets.rangeLow || 80}-${targets.rangeHigh || 180}): ${data.timeInRange}%
- Hipo olayları (<${targets.hypoThreshold || 70}): ${data.hypoCount}
- Hiper olayları (>${targets.hyperThreshold || 250}): ${data.hyperCount}
- Toplam ölçüm: ${data.totalReadings}
- Kaydedilen öğün: ${data.mealsLogged}
- En iyi gün: ${data.bestDay}
- En zorlu gün: ${data.worstDay}

Destekleyici, kişiselleştirilmiş bir haftalık özet oluştur:
1. Genel değerlendirme (1-2 cümle)
2. Haftanın kazanımları/pozitif yönleri
3. Geliştirilecek alanlar
4. Gelecek hafta için 2-3 spesifik, uygulanabilir ipucu
5. Motive edici kapanış

Sıcak ve cesaretlendirici ol. Emoji kullanımını az tut.`;
}

function getWeeklySystemPrompt(lang) {
    if (lang === 'en') {
        return `You are DiaMate AI creating personalized weekly diabetes management summaries.

Your tone is:
- Warm and supportive like a caring coach
- Celebratory of wins, no matter how small
- Constructive about challenges, never judgmental
- Practical and actionable

Format the summary with clear sections using markdown headers.
Keep total length under 400 words.`;
    }

    return `Sen DiaMate AI, kişiselleştirilmiş haftalık diyabet yönetim özetleri oluşturuyorsun.

Tonun:
- İlgili bir koç gibi sıcak ve destekleyici
- Küçük de olsa kazanımları kutlayan
- Zorluklar hakkında yapıcı, asla yargılayıcı değil
- Pratik ve uygulanabilir

Özeti markdown başlıkları ile net bölümlerle formatla.
Toplam uzunluğu 400 kelimenin altında tut.`;
}

function getWeekRange() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    
    return {
        start: weekStart.toISOString().slice(0, 10),
        end: now.toISOString().slice(0, 10)
    };
}
