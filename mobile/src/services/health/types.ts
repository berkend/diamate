// Health Integration Types

export interface GlucoseReading {
  timestamp: string; // ISO 8601
  mgdl: number;
  source: HealthSource;
  sourceId?: string;
  trend?: GlucoseTrend;
  device?: string;
  context?: GlucoseContext;
  notes?: string;
}

export type HealthSource = 
  | 'manual'
  | 'apple_health'
  | 'health_connect'
  | 'samsung_health'
  | 'dexcom'
  | 'libre'
  | 'medtronic';

export type GlucoseTrend = 
  | 'rising_fast'
  | 'rising'
  | 'stable'
  | 'falling'
  | 'falling_fast';

export type GlucoseContext = 
  | 'fasting'
  | 'before_meal'
  | 'after_meal'
  | 'before_sleep'
  | 'random';

export interface HealthPlatformSettings {
  platform: 'apple_health' | 'health_connect' | 'samsung_health';
  readEnabled: boolean;
  writeEnabled: boolean;
  grantedTypes: HealthDataType[];
  syncEnabled: boolean;
  lastSyncAt?: string;
}

export type HealthDataType = 
  | 'blood_glucose'
  | 'nutrition'
  | 'sleep'
  | 'activity'
  | 'heart_rate'
  | 'weight';

export interface CGMConnector {
  vendor: 'dexcom' | 'libre' | 'medtronic';
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  lastSyncAt?: string;
  deviceInfo?: Record<string, any>;
}

export interface HealthSummary {
  period: {
    start: string;
    end: string;
    days: number;
  };
  stats: {
    totalReadings: number;
    avgBG: number | null;
    stdDev: number | null;
    minBG: number | null;
    maxBG: number | null;
    hypoCount: number;
    hyperCount: number;
    inRangeCount: number;
    timeInRangePct: number | null;
  };
  sources: HealthSource[];
}

// Platform-specific permission types
export interface HealthKitPermissions {
  read: string[]; // HKQuantityTypeIdentifier values
  write: string[];
}

export interface HealthConnectPermissions {
  read: string[]; // Health Connect record types
  write: string[];
}
