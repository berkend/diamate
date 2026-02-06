/**
 * DiaMate Type Definitions
 */

export type GlucoseTrend = 'rising_fast' | 'rising' | 'stable' | 'falling' | 'falling_fast';

export type HealthProvider = 'apple_health' | 'health_connect' | 'dexcom' | 'libre' | 'manual';

export interface GlucoseReading {
  id?: string;
  mgdl: number;
  timestamp: string;
  source?: HealthProvider;
  trend?: GlucoseTrend;
}

export interface HealthConnection {
  provider: HealthProvider;
  connected: boolean;
  lastSync?: string;
  permissions: string[];
}

export interface UserProfile {
  id?: string;
  email?: string;
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  diabetesType?: 'T1' | 'T2' | 'GDM' | 'Other' | 'type1' | 'type2' | 'gestational' | 'prediabetes';
  targetLow?: number;
  targetHigh?: number;
  insulinType?: string;
  carbRatio?: number;
  correctionFactor?: number;
  icr?: number; // Insulin to Carb Ratio
  isf?: number; // Insulin Sensitivity Factor
  activeInsulinHours?: number;
  language?: 'tr' | 'en';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  createdAt?: string;
}

export interface MealLog {
  id: string;
  timestamp: string;
  description?: string;
  carbs?: number;
  protein?: number;
  fat?: number;
  calories?: number;
  imageUrl?: string;
  glucoseBefore?: number;
  glucoseAfter?: number;
  items?: MealItem[];
  totalCarbs?: number;
  photoUsed?: boolean;
  notes?: string;
}

export interface InsulinDose {
  id: string;
  timestamp: string;
  units: number;
  type: 'rapid' | 'long' | 'mixed';
  notes?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Entitlement {
  isPro: boolean;
  plan: 'FREE' | 'PREMIUM' | 'PRO';
  quotas: {
    chatPerDay: number;
    visionPerDay: number;
  };
  usage: {
    dailyChatCount: number;
    dailyVisionCount: number;
    lastResetDate: string;
  };
}

export interface AIMemory {
  profileFacts: Record<string, any>;
  memorySummary: string;
  conversationHistory: ChatMessage[];
}

export interface Subscription {
  tier: 'free' | 'premium' | 'pro';
  expiresAt?: string;
  isActive: boolean;
}

// API Request/Response Types
export interface AIChatRequest {
  messages: AIMessage[];
  context?: object;
  lang: 'tr' | 'en';
  recentContext?: object;
}

export interface AIChatResponse {
  text: string;
  error?: string;
  showCalculatorButton?: boolean;
}

export interface AIVisionRequest {
  imageBase64: string;
  lang: 'tr' | 'en';
}

export interface AIVisionResponse {
  items: Array<{
    name: string;
    carbs_g: number;
    portion?: string;
  }>;
  total_carbs_g: number;
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

// Additional types for screens
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MealItem {
  name: string;
  carbs_g: number;
  portion?: string;
  confidence?: 'high' | 'medium' | 'low';
}
