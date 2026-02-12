/**
 * DiaMate Global State Store (Zustand)
 * Manages app state, user profile, health data, and subscriptions
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlucoseReading, MealLog, UserProfile, Entitlement, AIMemory, FavoriteMeal } from '../types';

interface AppState {
  // Auth & Profile
  isOnboarded: boolean;
  userId: string | null;
  profile: UserProfile | null;
  
  // Subscription
  entitlement: Entitlement;
  
  // Health Data
  glucoseReadings: GlucoseReading[];
  mealLogs: MealLog[];
  lastHealthSync: string | null;
  
  // AI Personalization
  aiMemory: AIMemory;
  aiPersonalizationEnabled: boolean;
  
  // Favorite Meals
  favoriteMeals: FavoriteMeal[];
  
  // Settings
  language: 'tr' | 'en';
  
  // Actions
  initialize: () => Promise<void>;
  setUserId: (id: string) => void;
  setOnboarded: (value: boolean) => void;
  setProfile: (profile: Partial<UserProfile>) => void;
  setEntitlement: (entitlement: Entitlement) => void;
  logout: () => void;
  
  // Health Actions
  addGlucoseReading: (reading: GlucoseReading) => void;
  addMealLog: (meal: MealLog) => void;
  syncHealthData: (readings: GlucoseReading[]) => void;
  
  // AI Actions
  updateAIMemory: (memory: Partial<AIMemory>) => void;
  clearAIMemory: () => void;
  toggleAIPersonalization: (enabled: boolean) => void;
  
  // Favorite Meal Actions
  addFavoriteMeal: (meal: FavoriteMeal) => void;
  removeFavoriteMeal: (id: string) => void;
  useFavoriteMeal: (id: string) => void;
  
  // Computed
  getRecentContext: () => object;
  getTodayGlucose: () => GlucoseReading[];
  getWeekStats: () => { avgBG: number | null; timeInRange: number | null; readings: number; hypoCount?: number; hyperCount?: number };
}

const DEFAULT_ENTITLEMENT: Entitlement = {
  isPro: false,
  plan: 'FREE',
  quotas: {
    chatPerDay: 5,
    visionPerDay: 0,
  },
  usage: {
    dailyChatCount: 0,
    dailyVisionCount: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
  },
};

const DEFAULT_AI_MEMORY: AIMemory = {
  profileFacts: {},
  memorySummary: '',
  conversationHistory: [],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      isOnboarded: false,
      userId: null,
      profile: null,
      entitlement: DEFAULT_ENTITLEMENT,
      glucoseReadings: [],
      mealLogs: [],
      lastHealthSync: null,
      aiMemory: DEFAULT_AI_MEMORY,
      aiPersonalizationEnabled: true,
      favoriteMeals: [],
      language: 'tr',

      // Initialize
      initialize: async () => {
        // Check and reset daily quotas if needed
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        
        if (state.entitlement.usage.lastResetDate !== today) {
          set({
            entitlement: {
              ...state.entitlement,
              usage: {
                dailyChatCount: 0,
                dailyVisionCount: 0,
                lastResetDate: today,
              },
            },
          });
        }
      },

      // Auth & Profile
      setUserId: (id) => set({ userId: id }),

      logout: () => set({
        userId: null,
        isOnboarded: false,
        profile: null,
        entitlement: DEFAULT_ENTITLEMENT,
        glucoseReadings: [],
        mealLogs: [],
        aiMemory: DEFAULT_AI_MEMORY,
        favoriteMeals: [],
      }),

      setOnboarded: (value) => set({ isOnboarded: value }),
      
      setProfile: (profile) => set((state) => ({
        profile: { ...state.profile, ...profile } as UserProfile,
      })),

      // Subscription
      setEntitlement: (entitlement) => set({ entitlement }),

      // Health Data
      addGlucoseReading: (reading) => set((state) => {
        // Dedup by timestamp (within 5 minutes)
        const isDuplicate = state.glucoseReadings.some(
          (r) => Math.abs(new Date(r.timestamp).getTime() - new Date(reading.timestamp).getTime()) < 5 * 60 * 1000
        );
        if (isDuplicate) return state;
        
        return {
          glucoseReadings: [...state.glucoseReadings, reading].slice(-1000), // Keep last 1000
        };
      }),

      addMealLog: (meal) => set((state) => ({
        mealLogs: [...state.mealLogs, meal].slice(-500),
      })),

      syncHealthData: (readings) => set((state) => {
        // Merge and dedup
        const existingTimestamps = new Set(state.glucoseReadings.map((r) => r.timestamp));
        const newReadings = readings.filter((r) => !existingTimestamps.has(r.timestamp));
        
        return {
          glucoseReadings: [...state.glucoseReadings, ...newReadings]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 1000),
          lastHealthSync: new Date().toISOString(),
        };
      }),

      // AI Actions
      updateAIMemory: (memory) => set((state) => ({
        aiMemory: { ...state.aiMemory, ...memory },
      })),

      clearAIMemory: () => set({
        aiMemory: DEFAULT_AI_MEMORY,
      }),

      toggleAIPersonalization: (enabled) => set({
        aiPersonalizationEnabled: enabled,
      }),

      // Favorite Meals
      addFavoriteMeal: (meal) => set((state) => ({
        favoriteMeals: [...state.favoriteMeals, meal].slice(-50),
      })),

      removeFavoriteMeal: (id) => set((state) => ({
        favoriteMeals: state.favoriteMeals.filter((m) => m.id !== id),
      })),

      useFavoriteMeal: (id) => set((state) => ({
        favoriteMeals: state.favoriteMeals.map((m) =>
          m.id === id ? { ...m, usageCount: m.usageCount + 1 } : m
        ),
      })),

      // Computed Getters
      getRecentContext: () => {
        const state = get();
        if (!state.aiPersonalizationEnabled) return {};

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const weekReadings = state.glucoseReadings.filter(
          (r) => new Date(r.timestamp) >= weekAgo
        );
        
        if (weekReadings.length === 0) return {};

        const values = weekReadings.map((r) => r.mgdl);
        const avgBG = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const targetLow = state.profile?.targetLow || 70;
        const targetHigh = state.profile?.targetHigh || 180;
        const inRange = values.filter((v) => v >= targetLow && v <= targetHigh);
        const timeInRangePct = Math.round((inRange.length / values.length) * 100);
        const hypoEvents = values.filter((v) => v < 70).length;
        const hyperEvents = values.filter((v) => v > 250).length;

        const weekMeals = state.mealLogs.filter(
          (m) => new Date(m.timestamp) >= weekAgo
        );

        // Include insulin settings in profileFacts for AI dose calculations
        const profileFacts = {
          ...state.aiMemory.profileFacts,
          icr: state.profile?.icr,
          isf: state.profile?.isf,
          targetLow: state.profile?.targetLow,
          targetHigh: state.profile?.targetHigh,
          activeInsulinHours: state.profile?.activeInsulinHours,
          insulinType: state.profile?.insulinType,
        };

        return {
          stats: {
            avgBG,
            timeInRangePct,
            hypoEvents,
            hyperEvents,
            mealsLogged: weekMeals.length,
            readingsCount: weekReadings.length,
          },
          profileFacts,
          memorySummary: state.aiMemory.memorySummary,
        };
      },

      getTodayGlucose: () => {
        const state = get();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return state.glucoseReadings.filter(
          (r) => new Date(r.timestamp) >= today
        );
      },

      getWeekStats: () => {
        const state = get();
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const weekReadings = state.glucoseReadings.filter(
          (r) => new Date(r.timestamp) >= weekAgo
        );
        
        if (weekReadings.length === 0) {
          return { avgBG: null, timeInRange: null, readings: 0 };
        }

        const values = weekReadings.map((r) => r.mgdl);
        const avgBG = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const targetLow = state.profile?.targetLow || 70;
        const targetHigh = state.profile?.targetHigh || 180;
        const inRange = values.filter((v) => v >= targetLow && v <= targetHigh);
        
        return {
          avgBG,
          timeInRange: Math.round((inRange.length / values.length) * 100),
          readings: weekReadings.length,
          hypoCount: values.filter((v) => v < 70).length,
          hyperCount: values.filter((v) => v > 250).length,
        };
      },
    }),
    {
      name: 'diamate-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isOnboarded: state.isOnboarded,
        userId: state.userId,
        profile: state.profile,
        entitlement: state.entitlement,
        glucoseReadings: state.glucoseReadings.slice(-500),
        mealLogs: state.mealLogs.slice(-200),
        lastHealthSync: state.lastHealthSync,
        aiMemory: state.aiMemory,
        aiPersonalizationEnabled: state.aiPersonalizationEnabled,
        favoriteMeals: state.favoriteMeals,
        language: state.language,
      }),
    }
  )
);
