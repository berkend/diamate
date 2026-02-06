-- DiaMate Pro - Supabase Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    language TEXT DEFAULT 'tr',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFILE_FACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profile_facts (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    facts JSONB NOT NULL DEFAULT '{
        "version": 1,
        "identity": { "displayName": "", "language": "tr" },
        "diabetes": {
            "type": "T1D",
            "units": "mg/dL",
            "targets": { "bgTarget": 110, "rangeLow": 80, "rangeHigh": 180, "hypoThreshold": 70, "hyperThreshold": 250 },
            "insulin": { "basal": { "name": "", "doseU": 0, "time": "" }, "bolus": { "name": "" } },
            "ratios": { "carbRatio_gPerU": 10, "sensitivity_mgdlPerU": 30 },
            "safety": { "maxBolusU": 15, "maxDailyBolusU": 60 }
        },
        "lifestyle": { "mealPatterns": [], "activity": {}, "sleep": {} },
        "preferences": { "foodsDisliked": [], "tone": "friendly", "coachingStyle": "supportive" },
        "permissions": { "aiPersonalizationEnabled": true, "sendPhotosToAI": true, "sendRecentSummaryToAI": true }
    }'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI_MEMORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_memory (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    summary_text TEXT DEFAULT '',
    is_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled', 'grace', 'past_due', 'pending')),
    plan TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO')),
    product_id TEXT,
    external_id TEXT, -- iOS transaction ID or Android purchase token reference
    original_transaction_id TEXT, -- For iOS subscription tracking
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

-- ============================================
-- USAGE TABLE (Monthly quotas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    month_key TEXT NOT NULL, -- 'YYYY-MM'
    day_key TEXT, -- 'YYYY-MM-DD' for daily limits
    chat_count INTEGER DEFAULT 0,
    vision_count INTEGER DEFAULT 0,
    insight_count INTEGER DEFAULT 0,
    weekly_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month_key)
);

-- Daily usage for FREE tier
CREATE TABLE IF NOT EXISTS public.daily_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    day_key TEXT NOT NULL, -- 'YYYY-MM-DD'
    chat_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, day_key)
);

-- ============================================
-- INSIGHT_THROTTLE TABLE (prevent spam)
-- ============================================
CREATE TABLE IF NOT EXISTS public.insight_throttle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    last_triggered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, trigger_type)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_user_month ON public.usage(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_day ON public.daily_usage(user_id, day_key);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own profile_facts" ON public.profile_facts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile_facts" ON public.profile_facts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile_facts" ON public.profile_facts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own ai_memory" ON public.ai_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_memory" ON public.ai_memory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_memory" ON public.ai_memory FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own usage" ON public.usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own daily_usage" ON public.daily_usage FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
    
    INSERT INTO public.profile_facts (user_id) VALUES (NEW.id);
    INSERT INTO public.ai_memory (user_id) VALUES (NEW.id);
    INSERT INTO public.subscriptions (user_id, platform, plan, status)
    VALUES (NEW.id, 'web', 'FREE', 'active');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to increment usage atomically
CREATE OR REPLACE FUNCTION public.increment_usage(
    p_user_id UUID,
    p_month_key TEXT,
    p_field TEXT,
    p_amount INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.usage (user_id, month_key, chat_count, vision_count, insight_count, weekly_count)
    VALUES (p_user_id, p_month_key, 0, 0, 0, 0)
    ON CONFLICT (user_id, month_key) DO NOTHING;
    
    EXECUTE format('UPDATE public.usage SET %I = %I + $1, updated_at = NOW() WHERE user_id = $2 AND month_key = $3', p_field, p_field)
    USING p_amount, p_user_id, p_month_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment daily usage
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
    p_user_id UUID,
    p_day_key TEXT,
    p_amount INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.daily_usage (user_id, day_key, chat_count)
    VALUES (p_user_id, p_day_key, p_amount)
    ON CONFLICT (user_id, day_key) 
    DO UPDATE SET chat_count = daily_usage.chat_count + p_amount, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current entitlement
CREATE OR REPLACE FUNCTION public.get_entitlement(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_subscription RECORD;
    v_usage RECORD;
    v_daily_usage RECORD;
    v_profile_facts RECORD;
    v_month_key TEXT;
    v_day_key TEXT;
    v_is_pro BOOLEAN;
BEGIN
    v_month_key := to_char(NOW(), 'YYYY-MM');
    v_day_key := to_char(NOW(), 'YYYY-MM-DD');
    
    -- Get best subscription
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE user_id = p_user_id AND status IN ('active', 'grace')
    ORDER BY CASE plan WHEN 'PRO' THEN 1 ELSE 2 END
    LIMIT 1;
    
    v_is_pro := COALESCE(v_subscription.plan = 'PRO', false);
    
    -- Get monthly usage
    SELECT * INTO v_usage
    FROM public.usage
    WHERE user_id = p_user_id AND month_key = v_month_key;
    
    -- Get daily usage
    SELECT * INTO v_daily_usage
    FROM public.daily_usage
    WHERE user_id = p_user_id AND day_key = v_day_key;
    
    -- Get profile facts for permissions
    SELECT * INTO v_profile_facts
    FROM public.profile_facts
    WHERE user_id = p_user_id;
    
    RETURN json_build_object(
        'isPro', v_is_pro,
        'plan', COALESCE(v_subscription.plan, 'FREE'),
        'status', COALESCE(v_subscription.status, 'active'),
        'platform', COALESCE(v_subscription.platform, 'web'),
        'currentPeriodEnd', v_subscription.current_period_end,
        'quotas', json_build_object(
            'chatPerMonth', CASE WHEN v_is_pro THEN 500 ELSE 0 END,
            'chatPerDay', CASE WHEN v_is_pro THEN 0 ELSE 5 END,
            'visionPerMonth', CASE WHEN v_is_pro THEN 200 ELSE 0 END,
            'insightPerMonth', CASE WHEN v_is_pro THEN 150 ELSE 0 END,
            'weeklyPerMonth', CASE WHEN v_is_pro THEN 4 ELSE 0 END
        ),
        'usage', json_build_object(
            'chatCount', COALESCE(v_usage.chat_count, 0),
            'visionCount', COALESCE(v_usage.vision_count, 0),
            'insightCount', COALESCE(v_usage.insight_count, 0),
            'weeklyCount', COALESCE(v_usage.weekly_count, 0),
            'dailyChatCount', COALESCE(v_daily_usage.chat_count, 0)
        ),
        'aiPersonalizationEnabled', COALESCE(v_profile_facts.facts->'permissions'->>'aiPersonalizationEnabled', 'true')::boolean
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
