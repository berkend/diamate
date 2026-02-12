// DiaMate AI Vision - Supabase Edge Function
// Food photo analysis with full macro breakdown + Turkish cuisine knowledge
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const FREE_VISION_LIMIT = 2

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return resp(405, { error: 'method_not_allowed' })
  }
  if (!OPENAI_API_KEY) {
    return resp(500, { error: 'config_error', message: 'Vision service not configured' })
  }

  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) {
    return resp(401, { error: 'auth_required', message: 'Giriş yapmanız gerekiyor' })
  }

  let body: any
  try { body = await req.json() } catch { return resp(400, { error: 'invalid_json' }) }

  const { imageDataUrl, lang = 'tr' } = body
  if (!imageDataUrl) {
    return resp(400, { error: 'invalid_request', message: 'Image required' })
  }

  // Check image size
  if (imageDataUrl.length > 1.5 * 1024 * 1024 * 1.33) {
    return resp(400, { error: 'image_too_large', message: 'Image must be under 1.5MB' })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (!user || authErr) {
      return resp(401, { error: 'invalid_token', message: 'Geçersiz oturum' })
    }
    const userId = user.id
    const today = new Date().toISOString().split('T')[0]
    const todayStart = today + 'T00:00:00Z'

    // Check subscription
    let isPro = false
    const { data: sub } = await supabase
      .from('subscriptions').select('plan, status, current_period_end')
      .eq('user_id', userId).single()

    if (sub?.status === 'active' && (!sub.current_period_end || new Date(sub.current_period_end) > new Date())) {
      isPro = sub.plan === 'pro'
    }

    if (!isPro) {
      const { count } = await supabase
        .from('usage_tracking').select('*', { count: 'exact', head: true })
        .eq('user_id', userId).eq('feature', 'vision').gte('used_at', todayStart)

      if ((count || 0) >= FREE_VISION_LIMIT) {
        return resp(429, {
          error: 'quota_exceeded', code: 'quota_exceeded',
          message: lang === 'en'
            ? `Daily photo analysis limit reached (${FREE_VISION_LIMIT}/day). Upgrade to PRO!`
            : `Günlük fotoğraf analizi limitine ulaştınız (${FREE_VISION_LIMIT}/gün). PRO'ya yükseltin!`
        })
      }
    }

    const prompt = getVisionPrompt(lang)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } }
          ]
        }],
        max_tokens: 500,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('OpenAI Vision error:', data)
      return resp(500, { error: 'ai_error', message: 'Vision service error' })
    }

    const aiResponse = data.choices[0].message.content
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return resp(500, { error: 'parse_error', message: 'Could not parse response' })
    }
    const result = JSON.parse(jsonMatch[0])

    // Track usage
    try {
      await supabase.from('usage_tracking').insert({
        user_id: userId, feature: 'vision',
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        used_at: new Date().toISOString(),
      })
    } catch (e) { console.warn('Usage tracking failed:', e) }

    return resp(200, {
      items: result.items || [],
      total_carbs_g: result.total_carbs_g || 0,
      total_calories: result.total_calories || 0,
      total_protein_g: result.total_protein_g || 0,
      total_fat_g: result.total_fat_g || 0,
      total_fiber_g: result.total_fiber_g || 0,
      glycemicImpact: result.glycemicImpact || 'medium',
      notes: result.notes || '',
      confidence: result.confidence || 'medium',
    })
  } catch (err) {
    console.error('Vision error:', err)
    return resp(500, { error: 'server_error', message: 'Internal server error' })
  }
})

function resp(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getVisionPrompt(lang: string): string {
  return lang === 'en'
    ? `You are a diabetes nutrition expert. Analyze this food photo and return ONLY valid JSON with full macro breakdown:
{"items":[{"name":"food name","portion":"estimated portion with grams","carbs_g":0,"calories":0,"protein_g":0,"fat_g":0,"fiber_g":0,"glycemicIndex":"low|medium|high","confidence":"high|medium|low"}],"total_carbs_g":0,"total_calories":0,"total_protein_g":0,"total_fat_g":0,"total_fiber_g":0,"glycemicImpact":"low|medium|high","notes":"diabetes-specific note","confidence":"high|medium|low"}

Rules:
- Estimate portions in grams when possible
- glycemicIndex per item: low (<55), medium (55-69), high (70+)
- glycemicImpact: overall meal impact on blood sugar
- For diabetes patients: highlight high-GI items in notes
- Be accurate with all macro estimates`
    : `Sen bir diyabet beslenme uzmanısın. Bu yemek fotoğrafını analiz et ve tam makro dökümü ile SADECE geçerli JSON döndür:
{"items":[{"name":"yemek adı","portion":"gram cinsinden tahmini porsiyon","carbs_g":0,"calories":0,"protein_g":0,"fat_g":0,"fiber_g":0,"glycemicIndex":"low|medium|high","confidence":"high|medium|low"}],"total_carbs_g":0,"total_calories":0,"total_protein_g":0,"total_fat_g":0,"total_fiber_g":0,"glycemicImpact":"low|medium|high","notes":"diyabete özel kısa not","confidence":"high|medium|low"}

Kurallar:
- Porsiyonları mümkünse gram cinsinden tahmin et
- glycemicIndex: düşük (<55), orta (55-69), yüksek (70+)
- Türk mutfağını iyi bil: lahmacun (~30g KH), pide (~45g KH), mantı (~35g KH), börek (~25g KH), pilav (~45g KH), mercimek çorbası (~20g KH), karnıyarık (~15g KH), baklava (~30g KH), simit (~45g KH), gözleme (~35g KH), döner dürüm (~40g KH), künefe (~35g KH), kuru fasulye (~25g KH), bulgur pilavı (~35g KH)
- Diyabet hastaları için: yüksek GI yiyecekleri notlarda vurgula
- Tüm makro tahminlerinde doğru ol`
}
