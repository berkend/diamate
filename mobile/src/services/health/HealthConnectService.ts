/**
 * DiaMate Health Connect Service (Android)
 * Reads glucose, nutrition, activity, sleep from Health Connect
 */
import { Platform } from 'react-native';
import { GlucoseReading, GlucoseTrend } from '../../types';

// Note: In production, import from react-native-health-connect
// import { initialize, requestPermission, readRecords, insertRecords } from 'react-native-health-connect';

// Health Connect data types
const HC_BLOOD_GLUCOSE = 'BloodGlucose';
const HC_NUTRITION = 'Nutrition';
const HC_SLEEP_SESSION = 'SleepSession';
const HC_STEPS = 'Steps';
const HC_ACTIVE_CALORIES = 'ActiveCaloriesBurned';

// Permission configuration
export const HEALTH_CONNECT_PERMISSIONS = [
  { accessType: 'read', recordType: HC_BLOOD_GLUCOSE },
  { accessType: 'read', recordType: HC_NUTRITION },
  { accessType: 'read', recordType: HC_SLEEP_SESSION },
  { accessType: 'read', recordType: HC_STEPS },
  { accessType: 'read', recordType: HC_ACTIVE_CALORIES },
  { accessType: 'write', recordType: HC_BLOOD_GLUCOSE },
  { accessType: 'write', recordType: HC_NUTRITION },
];

class HealthConnectServiceClass {
  private initialized = false;
  private HealthConnect: any = null;

  /**
   * Check if Health Connect is available
   */
  isAvailable(): boolean {
    return Platform.OS === 'android';
  }

  /**
   * Load Health Connect module dynamically
   */
  private async loadModule(): Promise<boolean> {
    if (this.HealthConnect) return true;
    
    try {
      this.HealthConnect = await import('react-native-health-connect');
      return true;
    } catch (error) {
      console.error('Failed to load react-native-health-connect:', error);
      return false;
    }
  }

  /**
   * Initialize Health Connect
   */
  async initialize(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    if (this.initialized) return true;

    const loaded = await this.loadModule();
    if (!loaded) return false;

    try {
      const isInitialized = await this.HealthConnect.initialize();
      this.initialized = isInitialized;
      return isInitialized;
    } catch (error) {
      console.error('Health Connect init error:', error);
      return false;
    }
  }

  /**
   * Request permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return false;
    }

    try {
      const granted = await this.HealthConnect.requestPermission(HEALTH_CONNECT_PERMISSIONS);
      return granted.length > 0;
    } catch (error) {
      console.error('Health Connect permission error:', error);
      return false;
    }
  }

  /**
   * Check if permissions are granted
   */
  async checkPermissions(): Promise<boolean> {
    if (!this.initialized) return false;

    try {
      const permissions = await this.HealthConnect.getGrantedPermissions();
      return permissions.some((p: any) => p.recordType === HC_BLOOD_GLUCOSE);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get glucose readings from Health Connect
   */
  async getGlucoseReadings(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<GlucoseReading[]> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    try {
      const result = await this.HealthConnect.readRecords(HC_BLOOD_GLUCOSE, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });

      return result.records.map((record: any) => ({
        id: `hc_${record.time}_${record.level.inMilligramsPerDeciliter}`,
        source: 'healthconnect' as const,
        timestamp: record.time,
        mgdl: Math.round(record.level.inMilligramsPerDeciliter),
        device: record.metadata?.dataOrigin?.packageName || 'Health Connect',
      }));
    } catch (error) {
      console.error('Health Connect glucose error:', error);
      return [];
    }
  }

  /**
   * Get nutrition entries (carbs)
   */
  async getNutritionEntries(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<Array<{ timestamp: string; carbs: number }>> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    try {
      const result = await this.HealthConnect.readRecords(HC_NUTRITION, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });

      return result.records
        .filter((record: any) => record.totalCarbohydrate)
        .map((record: any) => ({
          timestamp: record.startTime,
          carbs: Math.round(record.totalCarbohydrate.inGrams),
        }));
    } catch (error) {
      console.error('Health Connect nutrition error:', error);
      return [];
    }
  }

  /**
   * Get step count
   */
  async getStepCount(startDate: Date, endDate: Date = new Date()): Promise<number> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return 0;
    }

    try {
      const result = await this.HealthConnect.readRecords(HC_STEPS, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });

      return result.records.reduce((total: number, record: any) => total + record.count, 0);
    } catch (error) {
      console.error('Health Connect steps error:', error);
      return 0;
    }
  }

  /**
   * Get sleep sessions
   */
  async getSleepSessions(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<Array<{ start: string; end: string; duration: number }>> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    try {
      const result = await this.HealthConnect.readRecords(HC_SLEEP_SESSION, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });

      return result.records.map((record: any) => ({
        start: record.startTime,
        end: record.endTime,
        duration: (new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / (1000 * 60), // minutes
      }));
    } catch (error) {
      console.error('Health Connect sleep error:', error);
      return [];
    }
  }

  /**
   * Write glucose reading to Health Connect
   */
  async writeGlucoseReading(mgdl: number, date: Date = new Date()): Promise<boolean> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return false;
    }

    try {
      await this.HealthConnect.insertRecords([
        {
          recordType: HC_BLOOD_GLUCOSE,
          time: date.toISOString(),
          level: {
            unit: 'milligramsPerDeciliter',
            value: mgdl,
          },
          specimenSource: 1, // Capillary blood
          mealType: 0, // Unknown
        },
      ]);
      return true;
    } catch (error) {
      console.error('Health Connect write glucose error:', error);
      return false;
    }
  }

  /**
   * Write nutrition entry to Health Connect
   */
  async writeNutritionEntry(carbs: number, date: Date = new Date()): Promise<boolean> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return false;
    }

    try {
      await this.HealthConnect.insertRecords([
        {
          recordType: HC_NUTRITION,
          startTime: date.toISOString(),
          endTime: date.toISOString(),
          totalCarbohydrate: {
            unit: 'grams',
            value: carbs,
          },
        },
      ]);
      return true;
    } catch (error) {
      console.error('Health Connect write nutrition error:', error);
      return false;
    }
  }

  /**
   * Get latest glucose reading
   */
  async getLatestGlucose(): Promise<GlucoseReading | null> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const readings = await this.getGlucoseReadings(oneDayAgo);
    return readings.length > 0 ? readings[0] : null;
  }

  /**
   * Calculate trend from recent readings
   */
  calculateTrend(readings: GlucoseReading[]): GlucoseTrend | undefined {
    if (readings.length < 3) return undefined;

    const recent = readings.slice(0, 3);
    const timeDiff = new Date(recent[0].timestamp).getTime() - new Date(recent[2].timestamp).getTime();
    
    if (timeDiff > 30 * 60 * 1000) return undefined;

    const diff = recent[0].mgdl - recent[2].mgdl;
    const rate = diff / (timeDiff / (15 * 60 * 1000));

    if (rate > 3) return 'rising_fast';
    if (rate > 1) return 'rising';
    if (rate < -3) return 'falling_fast';
    if (rate < -1) return 'falling';
    return 'stable';
  }

  /**
   * Open Health Connect app settings
   */
  async openHealthConnectSettings(): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.HealthConnect.openHealthConnectSettings();
    } catch (error) {
      console.error('Failed to open Health Connect settings:', error);
    }
  }
}

export const HealthConnectService = new HealthConnectServiceClass();
export default HealthConnectService;
