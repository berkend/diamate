-- DiaMate Subscription & Usage Tables
-- Run this in Supabase SQL Editor

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
    provider TEXT DEFAULT 'stripe' CHECK (provider IN ('stripe', 'apple', 'google')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    apple_receipt TEXT,
    google_purchase_token TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL CHECK (feature IN ('chat', 'vision', 'insight')),
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_user_feature ON usage_tracking(user_id, feature, used_at);

-- RLS Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Subscriptions: users can read their own
CREATE POLICY "sub_select" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Usage: users can read their own
CREATE POLICY "usage_select" ON usage_tracking FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for Netlify functions)
-- No additional policies needed - service role bypasses RLS
