-- DiaMate Pro - Health Integrations Schema Extension
-- Run this AFTER the main schema.sql

-- ============================================
-- CGM CONNECTORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.cgm_connectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vendor TEXT NOT NULL CHECK (vendor IN ('dexcom', 'libre', 'medtronic', 'tandem', 'omnipod')),
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
    
    -- OAuth tokens (encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Sync state
    scopes TEXT[], -- e.g., ['egv', 'calibrations', 'devices']
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,
    sync_cursor TEXT, -- For pagination/incremental sync
    
    -- Metadata
    device_info JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, vendor)
);

-- ============================================
-- HEALTH PLATFORM CONNECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.health_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('apple_health', 'health_connect', 'samsung_health')),
    
    -- Permissions granted
    read_enabled BOOLEAN DEFAULT false,
    write_enabled BOOLEAN DEFAULT false,
    granted_types TEXT[], -- e.g., ['blood_glucose', 'nutrition', 'sleep', 'activity']
    
    -- Sync state
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, platform)
);

-- ============================================
-- NORMALIZED GLUCOSE DATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.glucose_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Core data
    timestamp TIMESTAMPTZ NOT NULL,
    mgdl INTEGER NOT NULL CHECK (mgdl > 0 AND mgdl < 1000),
    
    -- Source tracking (provenance)
    source TEXT NOT NULL CHECK (source IN ('manual', 'apple_health', 'health_connect', 'samsung_health', 'dexcom', 'libre', 'medtronic', 'tandem', 'omnipod')),
    source_id TEXT, -- Original ID from source for deduplication
    
    -- Optional CGM data
    trend TEXT CHECK (trend IN ('rising_fast', 'rising', 'stable', 'falling', 'falling_fast', NULL)),
    trend_arrow TEXT, -- Raw trend indicator from CGM
    
    -- Context
    device TEXT,
    tags TEXT[],
    context TEXT, -- 'fasting', 'before_meal', 'after_meal', etc.
    notes TEXT,
    
    -- Metadata
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicates from same source
    UNIQUE(user_id, source, source_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cgm_connectors_user ON public.cgm_connectors(user_id);
CREATE INDEX IF NOT EXISTS idx_cgm_connectors_status ON public.cgm_connectors(status);
CREATE INDEX IF NOT EXISTS idx_health_connections_user ON public.health_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_glucose_readings_user_ts ON public.glucose_readings(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_glucose_readings_source ON public.glucose_readings(user_id, source);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.cgm_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glucose_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cgm_connectors" ON public.cgm_connectors 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own health_connections" ON public.health_connections 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own glucose_readings" ON public.glucose_readings 
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get deduplicated glucose readings for a time range
CREATE OR REPLACE FUNCTION public.get_glucose_readings(
    p_user_id UUID,
    p_start_ts TIMESTAMPTZ,
    p_end_ts TIMESTAMPTZ,
    p_sources TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    timestamp TIMESTAMPTZ,
    mgdl INTEGER,
    source TEXT,
    trend TEXT,
    device TEXT,
    context TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (date_trunc('minute', gr.timestamp))
        gr.id,
        gr.timestamp,
        gr.mgdl,
        gr.source,
        gr.trend,
        gr.device,
        gr.context
    FROM public.glucose_readings gr
    WHERE gr.user_id = p_user_id
        AND gr.timestamp >= p_start_ts
        AND gr.timestamp <= p_end_ts
        AND (p_sources IS NULL OR gr.source = ANY(p_sources))
    ORDER BY date_trunc('minute', gr.timestamp), 
             -- Prefer CGM over manual, then by import time
             CASE gr.source 
                 WHEN 'dexcom' THEN 1
                 WHEN 'libre' THEN 2
                 WHEN 'apple_health' THEN 3
                 WHEN 'health_connect' THEN 4
                 WHEN 'manual' THEN 5
                 ELSE 6
             END,
             gr.imported_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to build 7-day summary for AI context
CREATE OR REPLACE FUNCTION public.get_health_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_start_ts TIMESTAMPTZ;
    v_readings RECORD;
    v_profile RECORD;
    v_result JSON;
BEGIN
    v_start_ts := NOW() - INTERVAL '7 days';
    
    -- Get profile for targets
    SELECT facts INTO v_profile
    FROM public.profile_facts
    WHERE user_id = p_user_id;
    
    -- Calculate stats
    SELECT 
        COUNT(*) as total_readings,
        ROUND(AVG(mgdl)) as avg_bg,
        ROUND(STDDEV(mgdl)) as std_dev,
        MIN(mgdl) as min_bg,
        MAX(mgdl) as max_bg,
        COUNT(*) FILTER (WHERE mgdl < 70) as hypo_count,
        COUNT(*) FILTER (WHERE mgdl > 250) as hyper_count,
        COUNT(*) FILTER (WHERE mgdl >= 70 AND mgdl <= 180) as in_range_count,
        array_agg(DISTINCT source) as sources
    INTO v_readings
    FROM public.glucose_readings
    WHERE user_id = p_user_id
        AND timestamp >= v_start_ts;
    
    -- Build result
    v_result := json_build_object(
        'period', json_build_object(
            'start', v_start_ts,
            'end', NOW(),
            'days', 7
        ),
        'stats', json_build_object(
            'totalReadings', COALESCE(v_readings.total_readings, 0),
            'avgBG', v_readings.avg_bg,
            'stdDev', v_readings.std_dev,
            'minBG', v_readings.min_bg,
            'maxBG', v_readings.max_bg,
            'hypoCount', COALESCE(v_readings.hypo_count, 0),
            'hyperCount', COALESCE(v_readings.hyper_count, 0),
            'inRangeCount', COALESCE(v_readings.in_range_count, 0),
            'timeInRangePct', CASE 
                WHEN v_readings.total_readings > 0 
                THEN ROUND((v_readings.in_range_count::numeric / v_readings.total_readings) * 100)
                ELSE NULL
            END
        ),
        'sources', v_readings.sources
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
