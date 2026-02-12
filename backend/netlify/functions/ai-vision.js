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
            total_calories: result.total_calories || 0,
            total_protein_g: result.total_protein_g || 0,
            total_fat_g: result.total_fat_g || 0,
            total_fiber_g: result.total_fiber_g || 0,
            glycemicImpact: result.glycemicImpact || 'medium',
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
        return `You are a diabetes nutrition expert. Analyze this food photo and return ONLY valid JSON with full macro breakdown:

{
  "items": [
    { "name": "Food name", "portion": "estimated portion with grams", "carbs_g": 0, "calories": 0, "protein_g": 0, "fat_g": 0, "fiber_g": 0, "glycemicIndex": "low|medium|high", "confidence": "high|medium|low" }
  ],
  "total_carbs_g": 0,
  "total_calories": 0,
  "total_protein_g": 0,
  "total_fat_g": 0,
  "total_fiber_g": 0,
  "glycemicImpact": "low|medium|high",
  "notes": "Diabetes-specific note about the meal",
  "confidence": "high|medium|low"
}

Rules:
- Estimate portions in grams when possible
- glycemicIndex per item: low (<55), medium (55-69), high (70+)
- glycemicImpact: overall meal impact on blood sugar
- For diabetes patients: highlight high-GI items in notes
- Be conservative with carb estimates (slightly overestimate is safer)
- Return ONLY the JSON, no other text`;
    }

    return `Sen bir diyabet beslenme uzmanısın. Bu yemek fotoğrafını analiz et ve tam makro dökümü ile SADECE geçerli JSON döndür:

{
  "items": [
    { "name": "Yemek adı", "portion": "gram cinsinden tahmini porsiyon", "carbs_g": 0, "calories": 0, "protein_g": 0, "fat_g": 0, "fiber_g": 0, "glycemicIndex": "low|medium|high", "confidence": "high|medium|low" }
  ],
  "total_carbs_g": 0,
  "total_calories": 0,
  "total_protein_g": 0,
  "total_fat_g": 0,
  "total_fiber_g": 0,
  "glycemicImpact": "low|medium|high",
  "notes": "Diyabete özel kısa not",
  "confidence": "high|medium|low"
}

Kurallar:
- Porsiyonları mümkünse gram cinsinden tahmin et
- glycemicIndex: düşük (<55), orta (55-69), yüksek (70+)
- glycemicImpact: öğünün kan şekerine genel etkisi
- Türk mutfağını iyi bil: lahmacun (~30g KH), pide (~45g KH), mantı (~35g KH), börek (~25g KH), pilav (1 porsiyon ~45g KH), mercimek çorbası (~20g KH), karnıyarık (~15g KH), baklava (1 dilim ~30g KH), simit (~45g KH), gözleme (~35g KH), döner dürüm (~40g KH), künefe (~35g KH), su böreği (~30g KH), kuru fasulye (~25g KH), bulgur pilavı (~35g KH)
- Diyabet hastaları için: yüksek GI yiyecekleri notlarda vurgula
- Tahminlerde muhafazakar ol (karbonhidratı hafif fazla tahmin etmek daha güvenli)
- SADECE JSON döndür, başka metin yok`;
}
