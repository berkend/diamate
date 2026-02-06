// POST /.netlify/functions/ai-vision
// AI-powered food photo analysis

const { verifyAuth, errorResponse, successResponse, corsResponse } = require('./lib/auth');
const { checkQuota, incrementUsage, checkRateLimit } = require('./lib/quotas');
const { supabaseAdmin } = require('./lib/supabase');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024; // 1.5MB

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

    // Quota check (PRO required)
    const quotaCheck = await checkQuota(userId, 'vision');
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

    const { imageDataUrl, lang = 'tr' } = body;

    if (!imageDataUrl) {
        return errorResponse(400, 'invalid_request', 'imageDataUrl required');
    }

    // Check image size (base64 is ~33% larger than binary)
    const base64Data = imageDataUrl.split(',')[1] || imageDataUrl;
    const estimatedSize = (base64Data.length * 3) / 4;
    
    if (estimatedSize > MAX_IMAGE_SIZE) {
        return errorResponse(400, 'image_too_large', 'Image must be under 1.5MB');
    }

    // Check user permission for photo AI
    const { data: profileData } = await supabaseAdmin
        .from('profile_facts')
        .select('facts')
        .eq('user_id', userId)
        .single();

    const permissions = profileData?.facts?.permissions || {};
    if (permissions.sendPhotosToAI === false) {
        return errorResponse(403, 'permission_denied', 'Photo AI is disabled in settings');
    }

    try {
        const prompt = getVisionPrompt(lang);

        // Call OpenAI Vision
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { 
                                type: 'image_url', 
                                image_url: { 
                                    url: imageDataUrl,
                                    detail: 'low' // Use low detail for faster/cheaper processing
                                } 
                            }
                        ]
                    }
                ],
                max_tokens: 500,
                temperature: 0.3
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('OpenAI Vision error:', data);
            return errorResponse(500, 'ai_error', 'AI vision service error');
        }

        const aiResponse = data.choices[0].message.content;

        // Parse JSON from response
        let result;
        try {
            // Extract JSON from response (might be wrapped in markdown code blocks)
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError, 'Response:', aiResponse);
            return errorResponse(500, 'parse_error', 'Could not parse food analysis');
        }

        // Validate result structure
        if (!result.items || !Array.isArray(result.items)) {
            return errorResponse(500, 'invalid_response', 'Invalid analysis result');
        }

        // Increment usage
        await incrementUsage(userId, 'vision');

        return successResponse({
            items: result.items,
            total_carbs_g: result.total_carbs_g || result.items.reduce((sum, i) => sum + (i.carbs_g || 0), 0),
            notes: result.notes || '',
            confidence: result.confidence || 'medium'
        });

    } catch (err) {
        console.error('AI Vision error:', err);
        return errorResponse(500, 'server_error', 'Internal server error');
    }
};

/**
 * Get vision analysis prompt
 */
function getVisionPrompt(lang) {
    if (lang === 'en') {
        return `Analyze this food photo for a diabetes patient. Return ONLY valid JSON with this exact structure:

{
  "items": [
    { "name": "Food name", "portion": "estimated portion size", "carbs_g": 0, "confidence": "high|medium|low" }
  ],
  "total_carbs_g": 0,
  "notes": "Any relevant notes about the meal",
  "confidence": "high|medium|low"
}

Rules:
- Estimate carbohydrates in grams for each food item
- Be conservative with estimates (better to slightly overestimate carbs)
- Include portion size estimates
- If you cannot identify a food, mark confidence as "low"
- If the image is not food, return empty items array with a note
- Return ONLY the JSON, no other text`;
    }

    return `Bu yemek fotoğrafını bir diyabet hastası için analiz et. SADECE şu yapıda geçerli JSON döndür:

{
  "items": [
    { "name": "Yemek adı", "portion": "tahmini porsiyon", "carbs_g": 0, "confidence": "high|medium|low" }
  ],
  "total_carbs_g": 0,
  "notes": "Öğün hakkında notlar",
  "confidence": "high|medium|low"
}

Kurallar:
- Her yemek için gram cinsinden karbonhidrat tahmin et
- Tahminlerde muhafazakar ol (karbonhidratı hafif fazla tahmin etmek daha güvenli)
- Porsiyon boyutu tahminlerini dahil et
- Bir yemeği tanımlayamıyorsan, güveni "low" olarak işaretle
- Görsel yemek değilse, boş items dizisi ve not döndür
- SADECE JSON döndür, başka metin yok`;
}
