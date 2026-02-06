// Supabase client for Netlify Functions
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
}

// Admin client (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = { supabaseAdmin, supabaseUrl };
