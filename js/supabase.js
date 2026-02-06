/**
 * DiaMate Supabase Client
 * Authentication and Database
 */

// Supabase configuration
const SUPABASE_URL = 'https://rvqmbawssxhzqldkdpjo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2cW1iYXdzc3hoenFsZGtkcGpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDIxNjQsImV4cCI6MjA4NTk3ODE2NH0.8hlIUAYrhBDtOBDJ0PNuAiUguhuUow2FiUO26U1gbao';

// Supabase client instance
let supabase = null;

/**
 * Initialize Supabase client
 */
export async function initSupabase() {
    if (supabase) return supabase;
    
    // Load Supabase from CDN if not already loaded
    if (!window.supabase) {
        await loadSupabaseScript();
    }
    
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_IN') {
            window.dispatchEvent(new CustomEvent('auth:signin', { detail: session }));
        } else if (event === 'SIGNED_OUT') {
            window.dispatchEvent(new CustomEvent('auth:signout'));
        }
    });
    
    return supabase;
}

/**
 * Load Supabase script from CDN
 */
function loadSupabaseScript() {
    return new Promise((resolve, reject) => {
        if (window.supabase) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Get Supabase client
 */
export function getSupabase() {
    if (!supabase) {
        throw new Error('Supabase not initialized. Call initSupabase() first.');
    }
    return supabase;
}

// ==========================================
// AUTHENTICATION
// ==========================================

/**
 * Sign up with email and password
 */
export async function signUp(email, password) {
    const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
    });
    
    if (error) throw error;
    return data;
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({
        email,
        password,
    });
    
    if (error) throw error;
    return data;
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
    const { data, error } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    
    if (error) throw error;
    return data;
}

/**
 * Sign out
 */
export async function signOut() {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
    const { data: { user } } = await getSupabase().auth.getUser();
    return user;
}

/**
 * Get current session
 */
export async function getSession() {
    const { data: { session } } = await getSupabase().auth.getSession();
    return session;
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
    const { data, error } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) throw error;
    return data;
}

// ==========================================
// DATABASE - PROFILES
// ==========================================

/**
 * Save user profile to Supabase
 */
export async function saveProfileToCloud(profile) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await getSupabase()
        .from('profiles')
        .upsert({
            id: user.id,
            name: profile.name,
            diabetes_type: profile.diabetesType,
            target_low: profile.targetLow,
            target_high: profile.targetHigh,
            icr: profile.icr,
            isf: profile.isf,
            age: profile.age,
            gender: profile.gender,
            height: profile.height,
            weight: profile.weight,
            activity_level: profile.activityLevel,
            setup_complete: profile.setupComplete,
            updated_at: new Date().toISOString()
        });
    
    if (error) throw error;
}

/**
 * Load user profile from Supabase
 */
export async function loadProfileFromCloud() {
    const user = await getCurrentUser();
    if (!user) return null;
    
    const { data, error } = await getSupabase()
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (!data) return null;
    
    return {
        name: data.name,
        diabetesType: data.diabetes_type,
        targetLow: data.target_low,
        targetHigh: data.target_high,
        icr: data.icr,
        isf: data.isf,
        age: data.age,
        gender: data.gender,
        height: data.height,
        weight: data.weight,
        activityLevel: data.activity_level,
        setupComplete: data.setup_complete
    };
}

// ==========================================
// DATABASE - GLUCOSE READINGS
// ==========================================

/**
 * Save glucose reading to Supabase
 */
export async function saveGlucoseReading(reading) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await getSupabase()
        .from('glucose_readings')
        .insert({
            user_id: user.id,
            value: reading.value,
            context: reading.context || null,
            note: reading.note || null,
            recorded_at: reading.ts ? new Date(reading.ts).toISOString() : new Date().toISOString()
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Get glucose readings from Supabase
 */
export async function getGlucoseReadings(fromDate = null, toDate = null) {
    const user = await getCurrentUser();
    if (!user) return [];
    
    let query = getSupabase()
        .from('glucose_readings')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false });
    
    if (fromDate) {
        query = query.gte('recorded_at', fromDate.toISOString());
    }
    if (toDate) {
        query = query.lte('recorded_at', toDate.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return (data || []).map(r => ({
        id: r.id,
        ts: new Date(r.recorded_at).getTime(),
        value: r.value,
        context: r.context,
        note: r.note
    }));
}

// ==========================================
// DATABASE - MEALS
// ==========================================

/**
 * Save meal to Supabase
 */
export async function saveMeal(meal) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await getSupabase()
        .from('meals')
        .insert({
            user_id: user.id,
            source: meal.source || 'manual',
            items: meal.items || [],
            estimated_carbs: meal.estimatedCarbs,
            photo_url: meal.photoUrl || null,
            note: meal.note || null,
            recorded_at: meal.ts ? new Date(meal.ts).toISOString() : new Date().toISOString()
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Get meals from Supabase
 */
export async function getMeals(fromDate = null, toDate = null) {
    const user = await getCurrentUser();
    if (!user) return [];
    
    let query = getSupabase()
        .from('meals')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false });
    
    if (fromDate) {
        query = query.gte('recorded_at', fromDate.toISOString());
    }
    if (toDate) {
        query = query.lte('recorded_at', toDate.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return (data || []).map(m => ({
        id: m.id,
        ts: new Date(m.recorded_at).getTime(),
        source: m.source,
        items: m.items,
        estimatedCarbs: m.estimated_carbs,
        photoUrl: m.photo_url,
        note: m.note
    }));
}

// ==========================================
// DATABASE - INSULIN
// ==========================================

/**
 * Save insulin dose to Supabase
 */
export async function saveInsulinDose(dose) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await getSupabase()
        .from('insulin_doses')
        .insert({
            user_id: user.id,
            units: dose.units,
            insulin_type: dose.insulinType || 'rapid',
            reason: dose.reason || null,
            note: dose.note || null,
            recorded_at: dose.ts ? new Date(dose.ts).toISOString() : new Date().toISOString()
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Get insulin doses from Supabase
 */
export async function getInsulinDoses(fromDate = null, toDate = null) {
    const user = await getCurrentUser();
    if (!user) return [];
    
    let query = getSupabase()
        .from('insulin_doses')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false });
    
    if (fromDate) {
        query = query.gte('recorded_at', fromDate.toISOString());
    }
    if (toDate) {
        query = query.lte('recorded_at', toDate.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return (data || []).map(d => ({
        id: d.id,
        ts: new Date(d.recorded_at).getTime(),
        units: d.units,
        insulinType: d.insulin_type,
        reason: d.reason,
        note: d.note
    }));
}

// ==========================================
// DATABASE - AI MEMORY
// ==========================================

/**
 * Save AI memory to Supabase
 */
export async function saveAIMemory(memory) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await getSupabase()
        .from('ai_memory')
        .upsert({
            user_id: user.id,
            profile_facts: memory.profileFacts || {},
            memory_summary: memory.memorySummary || '',
            updated_at: new Date().toISOString()
        });
    
    if (error) throw error;
}

/**
 * Get AI memory from Supabase
 */
export async function getAIMemory() {
    const user = await getCurrentUser();
    if (!user) return null;
    
    const { data, error } = await getSupabase()
        .from('ai_memory')
        .select('*')
        .eq('user_id', user.id)
        .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    return data ? {
        profileFacts: data.profile_facts,
        memorySummary: data.memory_summary
    } : null;
}

// ==========================================
// SYNC UTILITIES
// ==========================================

/**
 * Sync local data to cloud
 */
export async function syncToCloud(localDB) {
    const user = await getCurrentUser();
    if (!user) return;
    
    // Sync profile
    if (localDB.profile) {
        await saveProfileToCloud(localDB.profile);
    }
    
    // Sync glucose readings (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentGlucose = (localDB.glucose || []).filter(g => g.ts > thirtyDaysAgo);
    
    for (const reading of recentGlucose) {
        try {
            await saveGlucoseReading(reading);
        } catch (e) {
            // Ignore duplicates
            if (!e.message?.includes('duplicate')) {
                console.error('Error syncing glucose:', e);
            }
        }
    }
    
    // Sync meals
    const recentMeals = (localDB.meals || []).filter(m => m.ts > thirtyDaysAgo);
    for (const meal of recentMeals) {
        try {
            await saveMeal(meal);
        } catch (e) {
            if (!e.message?.includes('duplicate')) {
                console.error('Error syncing meal:', e);
            }
        }
    }
    
    // Sync insulin
    const recentInsulin = (localDB.insulin || []).filter(i => i.ts > thirtyDaysAgo);
    for (const dose of recentInsulin) {
        try {
            await saveInsulinDose(dose);
        } catch (e) {
            if (!e.message?.includes('duplicate')) {
                console.error('Error syncing insulin:', e);
            }
        }
    }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
    const session = await getSession();
    return !!session;
}
