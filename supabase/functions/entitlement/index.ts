// DiaMate Entitlement - Supabase Edge Function
// Returns user plan, quotas, and daily usage
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PLANS: Record<string, any> = {
  free: { chatPerDay: 5, visionPerDay: 2, pdfExport: false, doctorShare: false, cloudSync: false, reminders: 2 },
  pro: { chatPerDay: 999, visionPerDay: 999, pdfExport: true, doctorShare: true, cloudSync: true, reminders: 999 },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const today = new Date().toISOString().split('T')[0]
  const todayStart = today + 'T00:00:00Z'
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  let plan = 'free'
  let dailyChatCount = 0
  let dailyVisionCount = 0

  if (token) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: { user }, error } = await supabase.auth.getUser(token)

      if (user && !error) {
        const userId = user.id

        const { data: sub } = await supabase
          .from('subscriptions').select('plan, status, current_period_end')
          .eq('user_id', userId).single()

        if (sub?.status === 'active' && (!sub.current_period_end || new Date(sub.current_period_end) > new Date())) {
          plan = sub.plan || 'free'
        }

        const { count: cc } = await supabase
          .from('usage_tracking').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('feature', 'chat').gte('used_at', todayStart)

        const { count: vc } = await supabase
          .from('usage_tracking').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('feature', 'vision').gte('used_at', todayStart)

        dailyChatCount = cc || 0
        dailyVisionCount = vc || 0
      }
    } catch (e) {
      console.error('Entitlement error:', e)
    }
  }

  const quotas = PLANS[plan] || PLANS.free
  return new Response(JSON.stringify({
    isPro: plan === 'pro',
    plan: plan.toUpperCase(),
    quotas,
    usage: { dailyChatCount, dailyVisionCount, lastResetDate: today },
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
  })
})
