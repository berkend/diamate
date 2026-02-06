// POST /.netlify/functions/ai-chat
// AI Chat endpoint - server-side Groq/OpenAI calls
// User NEVER sees API key

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Use Groq if available, fallback to OpenAI
const USE_GROQ = !!GROQ_API_KEY;
const API_KEY = GROQ_API_KEY || OPENAI_API_KEY;
const API_URL = USE_GROQ 
  ? 'https://api.groq.com/openai/v1/chat/completions'
  : 'https://api.openai.com/v1/chat/completions';
const MODEL = USE_GROQ ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

// Safety: Detect dangerous situations (not block dose calculations)
const DANGEROUS_PATTERNS = [
  /intihar|suicide|öldür|kill myself/i,
  /aşırı\s*doz|overdose/i,
];

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

  if (!API_KEY) {
    console.error('No API key configured (GROQ_API_KEY or OPENAI_API_KEY)');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'config_error', message: 'AI service not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const { messages, lang = 'tr', recentContext } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_request', message: 'Messages required' }) };
  }

  // Check for dangerous content (not dose requests)
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (lastUserMessage && isDangerous(lastUserMessage.content)) {
    return { statusCode: 200, headers, body: JSON.stringify({ text: getEmergencyResponse(lang) }) };
  }

  try {
    const systemPrompt = buildSystemPrompt(lang, recentContext);
    const aiMessages = [{ role: 'system', content: systemPrompt }, ...messages.slice(-10)];

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages: aiMessages, max_tokens: 1024, temperature: 0.7 })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('AI API error:', data);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'ai_error', message: 'AI service temporarily unavailable' }) };
    }

    let aiResponse = data.choices[0].message.content;
    
    // Add safety disclaimer to dose-related responses
    if (containsDoseInfo(aiResponse)) {
      aiResponse = addDoseDisclaimer(aiResponse, lang);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ text: aiResponse }) };
  } catch (err) {
    console.error('AI Chat error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'server_error', message: 'Internal server error' }) };
  }
};

function isDangerous(message) {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(message));
}

function containsDoseInfo(response) {
  return /(\d+)\s*(ünite|unite|units?|u|IU)/i.test(response);
}

function getEmergencyResponse(lang) {
  return lang === 'en'
    ? '🆘 If you are in crisis, please contact emergency services (112) or a mental health helpline immediately.'
    : '🆘 Acil bir durumda lütfen 112\'yi veya bir sağlık hattını arayın.';
}

function addDoseDisclaimer(response, lang) {
  const disclaimer = lang === 'en'
    ? '\n\n⚠️ *This is a calculated suggestion based on your settings. Always verify with your healthcare provider and adjust based on your experience.*'
    : '\n\n⚠️ *Bu, ayarlarınıza göre hesaplanmış bir öneridir. Her zaman sağlık uzmanınızla doğrulayın ve deneyiminize göre ayarlayın.*';
  return response + disclaimer;
}

function buildSystemPrompt(lang, recentContext) {
  let prompt = lang === 'en' ? `You are DiaMate AI, an intelligent diabetes management assistant that helps with insulin dose calculations.

## Your Role:
- Calculate insulin doses based on user's carb ratio and correction factor
- Help users understand their glucose patterns
- Provide meal-specific carbohydrate estimates
- Offer personalized diabetes management advice
- Explain dose calculations step by step

## Dose Calculation Rules:
- Bolus dose = (Carbs ÷ Carb Ratio) + ((Current BG - Target BG) ÷ Correction Factor)
- Always show your calculation steps
- Consider insulin on board (IOB) if mentioned
- Warn if calculated dose seems unusually high (>15 units for a meal)
- Recommend checking with healthcare provider for significant changes

## Safety Guidelines:
- For hypoglycemia (<70 mg/dL): Recommend 15-20g fast carbs FIRST, no insulin
- For severe hypo (<54 mg/dL): Emergency action, call for help
- Always add disclaimer that this is a suggestion, not medical advice
- Recommend consulting healthcare provider for ratio adjustments

## Personality:
- Helpful, precise, educational
- Show calculations clearly
- Use emojis sparingly
- Keep responses focused and actionable

Respond in English.` : `Sen DiaMate AI, insülin doz hesaplamalarında yardımcı olan akıllı bir diyabet yönetim asistanısın.

## Rolün:
- Kullanıcının karbonhidrat oranı ve düzeltme faktörüne göre insülin dozlarını hesapla
- Glukoz paternlerini anlamalarına yardımcı ol
- Öğüne özel karbonhidrat tahminleri sun
- Kişiselleştirilmiş diyabet yönetimi tavsiyeleri ver
- Doz hesaplamalarını adım adım açıkla

## Doz Hesaplama Kuralları:
- Bolus doz = (Karbonhidrat ÷ Karb Oranı) + ((Mevcut KŞ - Hedef KŞ) ÷ Düzeltme Faktörü)
- Her zaman hesaplama adımlarını göster
- Bahsedilmişse aktif insülini (IOB) dikkate al
- Hesaplanan doz alışılmadık yüksekse (öğün için >15 ünite) uyar
- Önemli değişiklikler için sağlık uzmanına danışmayı öner

## Güvenlik Kuralları:
- Hipoglisemi (<70 mg/dL) için: ÖNCE 15-20g hızlı karbonhidrat öner, insülin yok
- Ciddi hipo (<54 mg/dL) için: Acil müdahale, yardım çağır
- Her zaman bunun bir öneri olduğunu, tıbbi tavsiye olmadığını belirt
- Oran ayarlamaları için sağlık uzmanına danışmayı öner

## Kişiliğin:
- Yardımsever, kesin, eğitici
- Hesaplamaları net göster
- Emoji az kullan
- Yanıtları odaklı ve uygulanabilir tut

Türkçe yanıt ver.`;

  // Add user's insulin settings if available
  if (recentContext?.profileFacts) {
    const pf = recentContext.profileFacts;
    prompt += `\n\n## User's Insulin Settings:`;
    if (pf.icr) prompt += `\n- Carb Ratio (ICR): 1:${pf.icr} (1 unit per ${pf.icr}g carbs)`;
    if (pf.isf) prompt += `\n- Correction Factor (ISF): 1:${pf.isf} (1 unit drops BG by ${pf.isf} mg/dL)`;
    if (pf.targetLow && pf.targetHigh) prompt += `\n- Target Range: ${pf.targetLow}-${pf.targetHigh} mg/dL`;
    if (pf.insulinType) prompt += `\n- Insulin Type: ${pf.insulinType}`;
    if (pf.activeInsulinHours) prompt += `\n- Active Insulin Duration: ${pf.activeInsulinHours} hours`;
  }

  if (recentContext?.stats) {
    const s = recentContext.stats;
    prompt += `\n\n## User's Recent 7-Day Data:
- Average BG: ${s.avgBG || 'N/A'} mg/dL
- Time in Range: ${s.timeInRangePct || 'N/A'}%
- Hypo Events: ${s.hypoEvents || 0}
- Hyper Events: ${s.hyperEvents || 0}
- Meals Logged: ${s.mealsLogged || 0}`;
  }

  return prompt;
}
