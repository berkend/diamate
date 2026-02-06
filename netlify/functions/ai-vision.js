// POST /.netlify/functions/ai-vision
// AI Vision endpoint - food photo analysis
// User NEVER sees API key

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Vision requires OpenAI (Groq doesn't support vision yet)
const API_KEY = OPENAI_API_KEY || GROQ_API_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';

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
