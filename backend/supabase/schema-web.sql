-- DiaMate Web App - Additional Tables
-- Run this in Supabase SQL Editor AFTER schema.sql

-- ============================================
-- PROFILES TABLE (simplified for web app)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    diabetes_type TEXT CHECK (diabetes_type IN ('T1', 'T2', 'GDM', 'Other')),
    target_low INTEGER DEFAULT 70,
    target_high INTEGER DEFAULT 140,
    icr NUMERIC DEFAULT 10,
    isf NUMERIC DEFAULT 30,
    age INTEGER,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    height INTEGER,
    weight INTEGER,
    activity_level TEXT,
    setup_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GLUCOSE_READINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.glucose_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    value INTEGER NOT NULL,
    context TEXT,
    note TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT DEFAULT 'manual',
    items JSONB DEFAULT '[]'::jsonb,
    estimated_carbs INTEGER,
    photo_url TEXT,
    note TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INSULIN_DOSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.insulin_doses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    units NUMERIC NOT NULL,
    insulin_type TEXT DEFAULT 'rapid' CHECK (insulin_type IN ('rapid', 'long', 'mixed')),
    reason TEXT,
    note TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_glucose_user_date ON public.glucose_readings(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON public.meals(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_insulin_user_date ON public.insulin_doses(user_id, recorded_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glucose_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insulin_doses ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Glucose readings policies
CREATE POLICY "Users can view own glucose" ON public.glucose_readings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own glucose" ON public.glucose_readings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own glucose" ON public.glucose_readings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own glucose" ON public.glucose_readings FOR DELETE USING (auth.uid() = user_id);

-- Meals policies
CREATE POLICY "Users can view own meals" ON public.meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meals" ON public.meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meals" ON public.meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meals" ON public.meals FOR DELETE USING (auth.uid() = user_id);

-- Insulin doses policies
CREATE POLICY "Users can view own insulin" ON public.insulin_doses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own insulin" ON public.insulin_doses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own insulin" ON public.insulin_doses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own insulin" ON public.insulin_doses FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
