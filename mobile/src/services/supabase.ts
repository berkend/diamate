/**
 * DiaMate Supabase Service
 * Auth + Database
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { setAuthToken, clearAuthToken } from './api';

// Supabase config from environment
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || 'your-anon-key';

let supabase: SupabaseClient | null = null;

/**
 * Custom storage adapter for Expo SecureStore
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      console.error('SecureStore setItem error');
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      console.error('SecureStore removeItem error');
    }
  },
};

/**
 * Initialize Supabase client
 */
export async function initSupabase(): Promise<SupabaseClient> {
  if (supabase) return supabase;

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.access_token) {
      await setAuthToken(session.access_token);
    } else {
      await clearAuthToken();
    }
  });

  return supabase;
}

/**
 * Get Supabase client
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase not initialized. Call initSupabase() first.');
  }
  return supabase;
}

// ==========================================
// AUTH FUNCTIONS
// ==========================================

/**
 * Sign up with email
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with email
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
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
  await clearAuthToken();
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

// ==========================================
// PROFILE FUNCTIONS
// ==========================================

/**
 * Save user profile
 */
export async function saveProfile(userId: string, profile: object) {
  const { error } = await getSupabase()
    .from('profiles')
    .upsert({ id: userId, ...profile, updated_at: new Date().toISOString() });
  
  if (error) throw error;
}

/**
 * Get user profile
 */
export async function getProfile(userId: string) {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ==========================================
// AI MEMORY FUNCTIONS
// ==========================================

/**
 * Save AI memory
 */
export async function saveAIMemory(userId: string, memory: object) {
  const { error } = await getSupabase()
    .from('ai_memory')
    .upsert({ 
      user_id: userId, 
      ...memory, 
      updated_at: new Date().toISOString() 
    });
  
  if (error) throw error;
}

/**
 * Get AI memory
 */
export async function getAIMemory(userId: string) {
  const { data, error } = await getSupabase()
    .from('ai_memory')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Clear AI memory
 */
export async function clearAIMemoryDB(userId: string) {
  const { error } = await getSupabase()
    .from('ai_memory')
    .delete()
    .eq('user_id', userId);
  
  if (error) throw error;
}

// ==========================================
// SUBSCRIPTION FUNCTIONS
// ==========================================

/**
 * Update subscription status
 */
export async function updateSubscription(userId: string, subscription: {
  plan: string;
  expiresAt?: string;
  platform: 'ios' | 'android';
  transactionId?: string;
}) {
  const { error } = await getSupabase()
    .from('subscriptions')
    .upsert({
      user_id: userId,
      ...subscription,
      updated_at: new Date().toISOString(),
    });
  
  if (error) throw error;
}

/**
 * Get subscription status
 */
export async function getSubscription(userId: string) {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ==========================================
// DELETE ACCOUNT
// ==========================================

/**
 * Delete user account and all data
 */
export async function deleteAccount(userId: string) {
  // Delete in order (foreign key constraints)
  await getSupabase().from('ai_memory').delete().eq('user_id', userId);
  await getSupabase().from('subscriptions').delete().eq('user_id', userId);
  await getSupabase().from('glucose_readings').delete().eq('user_id', userId);
  await getSupabase().from('meal_logs').delete().eq('user_id', userId);
  await getSupabase().from('profiles').delete().eq('id', userId);
  
  // Sign out
  await signOut();
}
