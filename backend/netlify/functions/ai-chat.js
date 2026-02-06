// POST /.netlify/functions/ai-chat
// AI Chat with personalization and safety filtering

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { checkQuota, incrementUsage, checkRateLimit } = require('./lib/quotas');
const { isDoseRequest, getSafeDoseResponse, filterResponse, getSafetySystemPrompt } = require('./lib/ai-safety');
const { supabaseAdmin } = require('./lib/supabase');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

exports.handler = async (event) => {
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

    // Rate limit check
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
        return errorResponse(429, rateCheck.code, rateCheck.error);
    }

    // Quota check
    const quotaCheck = await checkQuota(userId, 'chat');
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

    const { messages, lang = 'tr', recentContext } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return errorResponse(400, 'invalid_request', 'Messages array required');
    }

    // Check if last message is a dose request - return safe response immediately
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage && isDoseRequest(lastUserMessage.content)) {
        const safeResponse = getSafeDoseResponse(lang);
        // Still increment usage for safety responses
        await incrementUsage(userId, 'chat');
        return successResponse(safeResponse);
    }

    try {
        // Build AI context
        const context = await buildAIContext(userId, lang, recentContext);
        
        // Build messages for OpenAI
        const systemMessage = {
            role: 'system',
            content: context.systemPrompt
        };

        const aiMessages = [systemMessage, ...messages.slice(-10)]; // Last 10 messages for context

        // Call OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: aiMessages,
                max_tokens: 1024,
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('OpenAI error:', data);
            return errorResponse(500, 'ai_error', 'AI service error');
        }

        let aiResponse = data.choices[0].message.content;

        // Safety filter the response
        const filtered = filterResponse(aiResponse, lang);

        // Increment usage
        await incrementUsage(userId, 'chat');

        return successResponse({
            text: filtered.text,
            wasFiltered: filtered.wasFiltered,
            showCalculatorButton: filtered.showCalculatorButton,
            isSafetyResponse: false
        });

    } catch (err) {
        console.error('AI Chat error:', err);
        return errorResponse(500, 'server_error', 'Internal server error');
    }
};

/**
 * Build AI context with user personalization
 */
async function buildAIContext(userId, lang, recentContext) {
    // Fetch user data including health summary
    const [profileResult, memoryResult, healthSummaryResult] = await Promise.all([
        supabaseAdmin.from('profile_facts').select('facts').eq('user_id', userId).single(),
        supabaseAdmin.from('ai_memory').select('summary_text, is_enabled').eq('user_id', userId).single(),
        supabaseAdmin.rpc('get_health_summary', { p_user_id: userId }).catch(() => ({ data: null }))
    ]);

    const profileFacts = profileResult.data?.facts || {};
    const aiMemory = memoryResult.data;
    const healthSummary = healthSummaryResult.data;
    const permissions = profileFacts.permissions || {};

    // Build system prompt
    let systemPrompt = getBaseSystemPrompt(lang);
    
    // Add safety rules
    systemPrompt += getSafetySystemPrompt();

    // Add personalization if enabled
    if (permissions.aiPersonalizationEnabled !== false) {
        // Add profile facts
        if (profileFacts.diabetes) {
            systemPrompt += `\n\n## User Profile:\n`;
            systemPrompt += `- Diabetes Type: ${profileFacts.diabetes.type || 'Unknown'}\n`;
            systemPrompt += `- Units: ${profileFacts.diabetes.units || 'mg/dL'}\n`;
            
            if (profileFacts.diabetes.targets) {
                const t = profileFacts.diabetes.targets;
                systemPrompt += `- Target Range: ${t.rangeLow || 80}-${t.rangeHigh || 180} ${profileFacts.diabetes.units || 'mg/dL'}\n`;
                systemPrompt += `- Hypo Threshold: ${t.hypoThreshold || 70}\n`;
            }

            if (profileFacts.diabetes.ratios) {
                const r = profileFacts.diabetes.ratios;
                systemPrompt += `- Carb Ratio (ICR): 1:${r.carbRatio_gPerU || 10}\n`;
                systemPrompt += `- Sensitivity (ISF): 1:${r.sensitivity_mgdlPerU || 30}\n`;
            }
        }

        if (profileFacts.preferences) {
            systemPrompt += `\n## Communication Preferences:\n`;
            systemPrompt += `- Tone: ${profileFacts.preferences.tone || 'friendly'}\n`;
            systemPrompt += `- Coaching Style: ${profileFacts.preferences.coachingStyle || 'supportive'}\n`;
        }

        // Add AI memory summary
        if (aiMemory?.is_enabled && aiMemory?.summary_text) {
            systemPrompt += `\n\n## What I Know About This User:\n${aiMemory.summary_text}\n`;
        }

        // Add integrated health data summary (from HealthKit/Health Connect/CGM)
        if (permissions.sendRecentSummaryToAI !== false && healthSummary?.stats) {
            const s = healthSummary.stats;
            systemPrompt += `\n\n## Integrated Health Data (Last 7 Days):\n`;
            systemPrompt += `- Total Readings: ${s.totalReadings || 0}\n`;
            systemPrompt += `- Average BG: ${s.avgBG || 'N/A'} mg/dL\n`;
            systemPrompt += `- Standard Deviation: ${s.stdDev || 'N/A'} mg/dL\n`;
            systemPrompt += `- Time in Range: ${s.timeInRangePct || 'N/A'}%\n`;
            systemPrompt += `- Hypo Events (<70): ${s.hypoCount || 0}\n`;
            systemPrompt += `- Hyper Events (>250): ${s.hyperCount || 0}\n`;
            systemPrompt += `- Min BG: ${s.minBG || 'N/A'} mg/dL\n`;
            systemPrompt += `- Max BG: ${s.maxBG || 'N/A'} mg/dL\n`;
            if (healthSummary.sources?.length > 0) {
                systemPrompt += `- Data Sources: ${healthSummary.sources.join(', ')}\n`;
            }
        }
    }

    // Add client-provided recent context (fallback if no server-side health data)
    if (permissions.sendRecentSummaryToAI !== false && recentContext && !healthSummary?.stats?.totalReadings) {
        systemPrompt += `\n\n## Recent 7-Day Summary (Client Data):\n`;
        if (recentContext.stats) {
            const s = recentContext.stats;
            systemPrompt += `- Average BG: ${s.avgBG || 'N/A'} mg/dL\n`;
            systemPrompt += `- Time in Range: ${s.timeInRangePct || 'N/A'}%\n`;
            systemPrompt += `- Hypo Events: ${s.hypoEvents || 0}\n`;
            systemPrompt += `- Hyper Events: ${s.hyperEvents || 0}\n`;
            systemPrompt += `- Meals Logged: ${s.mealsLogged || 0}\n`;
        }
    }

    return { systemPrompt };
}

/**
 * Base system prompt
 */
function getBaseSystemPrompt(lang) {
    if (lang === 'en') {
        return `You are DiaMate AI, a friendly and knowledgeable diabetes management assistant.

## Your Role:
- Help users understand their diabetes management
- Provide educational information about diabetes
- Offer emotional support and motivation
- Help interpret glucose patterns and trends
- Give general lifestyle and nutrition advice

## Your Personality:
- Warm, supportive, and encouraging
- Professional but conversational
- Use emojis occasionally to be friendly 😊
- Keep responses concise (2-4 paragraphs max)

## Important:
- You are NOT a replacement for medical advice
- Always recommend consulting healthcare providers for medication changes
- Respond in English`;
    }

    return `Sen DiaMate AI, dost canlısı ve bilgili bir diyabet yönetim asistanısın.

## Rolün:
- Kullanıcıların diyabet yönetimini anlamalarına yardımcı ol
- Diyabet hakkında eğitici bilgiler sun
- Duygusal destek ve motivasyon sağla
- Glukoz paternlerini ve trendleri yorumlamaya yardımcı ol
- Genel yaşam tarzı ve beslenme tavsiyeleri ver

## Kişiliğin:
- Sıcak, destekleyici ve cesaretlendirici
- Profesyonel ama samimi
- Ara sıra emoji kullan 😊
- Yanıtları kısa tut (maksimum 2-4 paragraf)

## Önemli:
- Tıbbi tavsiyenin yerini tutmazsın
- İlaç değişiklikleri için her zaman sağlık uzmanlarına danışmayı öner
- Türkçe yanıt ver`;
}
