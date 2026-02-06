/**
 * DiaMate Type Definitions
 */

// ==========================================
// USER & PROFILE
// ==========================================

export interface UserProfile {
  id?: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number; // cm
  weight: number; // kg
  diabetesType: 'T1' | 'T2' | 'GDM' | 'Other';
  diagnosisYear?: number;
  
  // Targets
  targetLow: number;  // mg/dL
  targetHigh: number; // mg/dL
  
  // Insulin Settings
  insulinType?: string;
  icr: number;              // Insulin-to-Carb Ratio: 1 unit per X grams
  isf: number;              // Insulin Sensitivity Factor: 1 unit drops BG by X mg/dL
  activeInsulinHours: number; // Duration of insulin action (typically 3-5 hours)
  maxBolus: number;         // Safety limit for single bolus
  
  // Preferences
  language: 'tr' | 'en';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active';
}

// ==========================================
// HEALTH DATA
// ==========================================

export type GlucoseSource = 
  | 'healthkit' 
  | 'healthconnect' 
  | 'dexcom' 
  | 'libre' 
  | 'manual';

export type GlucoseTrend = 
  | 'rising_fast' 
  | 'rising' 
  | 'stable' 
  | 'falling' 
  | 'falling_fast';

export interface GlucoseReading {
  id: string;
  source: GlucoseSource;
  timestamp: string; // ISO
  mgdl: number;
  trend?: GlucoseTrend;
  device?: string;
  tags?: string[];
}

export interface MealItem {
  name: string;
  portion?: string;
  carbs_g: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface MealLog {
  id: string;
  timestamp: string; // ISO
  items: MealItem[];
  totalCarbs: number;
  photoUsed: boolean;
  notes?: string;
  glucoseBefore?: number;
  glucoseAfter?: number;
}

// ==========================================
// SUBSCRIPTION & ENTITLEMENT
// ==========================================

export type PlanType = 'FREE' | 'PRO_MONTHLY' | 'PRO_YEARLY';

export interface Entitlement {
  isPro: boolean;
  plan: PlanType;
  expiresAt?: string;
  quotas: {
    chatPerDay: number;
    visionPerDay: number;
    insightsPerWeek?: number;
  };
  usage: {
    dailyChatCount: number;
    dailyVisionCount: number;
    lastResetDate: string;
  };
}

// ==========================================
// AI
// ==========================================

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface AIMemory {
  profileFacts: Record<string, any>;
  memorySummary: string;
  conversationHistory: Array<{
    user: string;
    assistant: string;
    timestamp: string;
  }>;
}

export interface AIChatRequest {
  messages: AIMessage[];
  lang: 'tr' | 'en';
  recentContext?: object;
}

export interface AIChatResponse {
  text: string;
  showCalculatorButton?: boolean;
  error?: string;
}

export interface AIVisionRequest {
  imageBase64: string;
  lang: 'tr' | 'en';
}

export interface AIVisionResponse {
  items: MealItem[];
  total_carbs_g: number;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

// ==========================================
// HEALTH CONNECTIONS
// ==========================================

export type HealthProvider = 
  | 'apple_health' 
  | 'health_connect' 
  | 'samsung_health' 
  | 'dexcom' 
  | 'libre';

export interface HealthConnection {
  provider: HealthProvider;
  connected: boolean;
  lastSync?: string;
  permissions: string[];
  error?: string;
}

// ==========================================
// NAVIGATION
// ==========================================

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Paywall: { source?: string };
  HealthConnections: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Meal: undefined;
  Chat: undefined;
  Insights: undefined;
  Settings: undefined;
};
