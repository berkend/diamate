/**
 * DiaMate Mobile App Types
 */

export interface GlucoseReading {
  id: string;
  mgdl: number;
  timestamp: string;
  source?: string;
  context?: 'fasting' | 'before_meal' | 'after_meal' | 'bedtime' | 'other';
  note?: string;
}

export type GlucoseTrend = 'rising_fast' | 'rising' | 'stable' | 'falling' | 'falling_fast';

export interface Meal {
  id: string;
  timestamp: string;
  items: MealItem[];
  totalCarbs: number;
  photoUrl?: string;
  note?: string;
}

export interface MealItem {
  name: string;
  carbs: number;
  portion?: string;
}

export interface InsulinDose {
  id: string;
  timestamp: string;
  units: number;
  type: 'rapid' | 'long' | 'mixed';
  reason?: string;
  note?: string;
}

export interface UserProfile {
  id?: string;
  name?: string;
  email?: string;
  diabetesType?: 'T1' | 'T2' | 'Gestational' | 'Other';
  targetLow?: number;
  targetHigh?: number;
  icr?: number; // Insulin to Carb Ratio
  isf?: number; // Insulin Sensitivity Factor
  age?: number;
  gender?: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active';
  setupComplete?: boolean;
}

export interface HealthData {
  glucose: GlucoseReading[];
  meals: Meal[];
  insulin: InsulinDose[];
  steps?: number;
  sleep?: SleepData[];
}

export interface SleepData {
  startDate: string;
  endDate: string;
  value: 'INBED' | 'ASLEEP' | 'AWAKE';
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIAnalysis {
  items: MealItem[];
  totalCarbs: number;
  confidence: number;
  suggestions?: string[];
}


export interface Entitlement {
  isPro: boolean;
  plan: string;
  quotas: {
    chatPerDay: number;
    visionPerDay: number;
    pdfExport?: boolean;
    doctorShare?: boolean;
    cloudSync?: boolean;
    reminders?: number;
  };
  usage: {
    dailyChatCount: number;
    dailyVisionCount: number;
    lastResetDate: string;
  };
}

export interface MealLog {
  id: string;
  timestamp: string;
  items: MealItem[];
  totalCarbs: number;
  photoUrl?: string;
  source?: string;
  note?: string;
}

export interface AIMemory {
  profileFacts: Record<string, any>;
  memorySummary: string;
  conversationHistory: AIMessage[];
}

export interface AIRequest {
  messages: { role: string; content: string }[];
  lang?: string;
  recentContext?: any;
}

export interface AIResponse {
  text: string;
  showCalculatorButton?: boolean;
}

export interface AIVisionRequest {
  imageDataUrl: string;
  lang?: string;
}

export interface AIVisionResponse {
  items: MealItem[];
  total_carbs_g: number;
  notes: string;
  confidence: string;
}
