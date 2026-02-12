// DiaMate AI Chat - Supabase Edge Function
// Replaces Netlify Function: /.netlify/functions/ai-chat
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const USE_GROQ = !!GROQ_API_KEY
const API_KEY = GROQ_API_KEY || OPENAI_API_KEY
const API_URL = USE_GROQ
  ? 'https://api.groq.com/openai/v1/chat/completions'
  : 'https://api.openai.com/v1/chat/completions'
const MODEL = USE_GROQ ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'

const IP_DAILY_LIMIT = 30
const FREE_CHAT_LIMIT = 5

const DANGEROUS_PATTERNS = [
  /intihar|suicide|öldür|kill myself/i,
  /aşırı\s*doz|overdose/i,
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'config_error', message: 'AI service not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'auth_required', message: 'Giriş yapmanız gerekiyor' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { messages, lang = 'tr', recentContext } = body
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'invalid_request', message: 'Messages required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check dangerous content
  const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop()
  if (lastUserMsg && DANGEROUS_PATTERNS.some(p => p.test(lastUserMsg.content))) {
    const emergencyText = lang === 'en'
      ? '🆘 If you are in crisis, please contact emergency services (112) or a mental health helpline immediately.'
      : '🆘 Acil bir durumda lütfen 112\'yi veya bir sağlık hattını arayın.'
    return new Response(JSON.stringify({ text: emergencyText }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (!user || authErr) {
      return new Response(JSON.stringify({ error: 'invalid_token', message: 'Geçersiz oturum' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = user.id
    const today = new Date().toISOString().split('T')[0]
    const todayStart = today + 'T00:00:00Z'

    // Check subscription
    let isPro = false
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', userId)
      .single()

    if (sub && sub.status === 'active' && (!sub.current_period_end || new Date(sub.current_period_end) > new Date())) {
      isPro = sub.plan === 'pro'
    }

    if (!isPro) {
      const { count: userCount } = await supabase
        .from('usage_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature', 'chat')
        .gte('used_at', todayStart)

      if ((userCount || 0) >= FREE_CHAT_LIMIT) {
        return new Response(JSON.stringify({
          error: 'quota_exceeded', code: 'quota_exceeded',
          message: lang === 'en'
            ? `Daily chat limit reached (${FREE_CHAT_LIMIT}/day). Upgrade to PRO for unlimited!`
            : `Günlük sohbet limitine ulaştınız (${FREE_CHAT_LIMIT}/gün). Sınırsız erişim için PRO'ya yükseltin!`
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const systemPrompt = buildSystemPrompt(lang, recentContext)
    const aiMessages = [{ role: 'system', content: systemPrompt }, ...messages.slice(-10)]

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages: aiMessages, max_tokens: 1024, temperature: 0.7 }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('AI API error:', data)
      return new Response(JSON.stringify({ error: 'ai_error', message: 'AI service temporarily unavailable' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let aiResponse = data.choices[0].message.content
    if (/(\d+)\s*(ünite|unite|units?|u|IU)/i.test(aiResponse)) {
      const disclaimer = lang === 'en'
        ? '\n\n⚠️ *This is a calculated suggestion. Always verify with your healthcare provider.*'
        : '\n\n⚠️ *Bu hesaplanmış bir öneridir. Her zaman sağlık uzmanınızla doğrulayın.*'
      aiResponse += disclaimer
    }

    // Track usage
    try {
      await supabase.from('usage_tracking').insert({
        user_id: userId, feature: 'chat',
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        used_at: new Date().toISOString(),
      })
    } catch (e) { console.warn('Usage tracking failed:', e) }

    return new Response(JSON.stringify({ text: aiResponse }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('AI Chat error:', err)
    return new Response(JSON.stringify({ error: 'server_error', message: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function buildSystemPrompt(lang: string, recentContext?: any): string {
  let prompt = lang === 'en'
    ? `You are DiaMate AI, an intelligent diabetes management assistant that helps with insulin dose calculations.
## Your Role:
- Calculate insulin doses based on user's carb ratio and correction factor
- Help users understand their glucose patterns
- Provide meal-specific carbohydrate estimates
- Offer personalized diabetes management advice
## Dose Calculation Rules:
- Bolus dose = (Carbs ÷ Carb Ratio) + ((Current BG - Target BG) ÷ Correction Factor)
- Always show your calculation steps
- Warn if calculated dose seems unusually high (>15 units for a meal)
## Safety Guidelines:
- For hypoglycemia (<70 mg/dL): Recommend 15-20g fast carbs FIRST, no insulin
- For severe hypo (<54 mg/dL): Emergency action, call for help
- Always add disclaimer that this is a suggestion, not medical advice
Respond in English.`
    : `Sen DiaMate AI, insülin doz hesaplamalarında yardımcı olan akıllı bir diyabet yönetim asistanısın.
## Rolün:
- Kullanıcının karbonhidrat oranı ve düzeltme faktörüne göre insülin dozlarını hesapla
- Glukoz paternlerini anlamalarına yardımcı ol
- Öğüne özel karbonhidrat tahminleri sun
- Kişiselleştirilmiş diyabet yönetimi tavsiyeleri ver
## Doz Hesaplama Kuralları:
- Bolus doz = (Karbonhidrat ÷ Karb Oranı) + ((Mevcut KŞ - Hedef KŞ) ÷ Düzeltme Faktörü)
- Her zaman hesaplama adımlarını göster
- Hesaplanan doz alışılmadık yüksekse (öğün için >15 ünite) uyar
## Güvenlik Kuralları:
- Hipoglisemi (<70 mg/dL) için: ÖNCE 15-20g hızlı karbonhidrat öner, insülin yok
- Ciddi hipo (<54 mg/dL) için: Acil müdahale, yardım çağır
- Her zaman bunun bir öneri olduğunu, tıbbi tavsiye olmadığını belirt
Türkçe yanıt ver.`

  if (recentContext?.profileFacts) {
    const pf = recentContext.profileFacts
    prompt += `\n\n## User's Insulin Settings:`
    if (pf.icr) prompt += `\n- Carb Ratio (ICR): 1:${pf.icr}`
    if (pf.isf) prompt += `\n- Correction Factor (ISF): 1:${pf.isf}`
    if (pf.targetLow && pf.targetHigh) prompt += `\n- Target Range: ${pf.targetLow}-${pf.targetHigh} mg/dL`
    if (pf.insulinType) prompt += `\n- Insulin Type: ${pf.insulinType}`
  }

  if (recentContext?.stats) {
    const s = recentContext.stats
    prompt += `\n\n## User's Recent 7-Day Data:
- Average BG: ${s.avgBG || 'N/A'} mg/dL
- Time in Range: ${s.timeInRangePct || 'N/A'}%
- Hypo Events: ${s.hypoEvents || 0}
- Hyper Events: ${s.hyperEvents || 0}`
  }

  return prompt
}
