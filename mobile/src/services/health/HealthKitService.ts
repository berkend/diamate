/**
 * DiaMate HealthKit Service (iOS)
 * Reads glucose, nutrition, activity, sleep from Apple Health
 */
import { Platform } from 'react-native';
import { GlucoseReading, GlucoseTrend } from '../../types';

// Note: In production, import from react-native-health
// import AppleHealthKit, { HealthKitPermissions, HealthValue, HealthInputOptions } from 'react-native-health';

// HealthKit type identifiers
const HK_BLOOD_GLUCOSE = 'HKQuantityTypeIdentifierBloodGlucose';
const HK_DIETARY_CARBS = 'HKQuantityTypeIdentifierDietaryCarbohydrates';
const HK_INSULIN = 'HKQuantityTypeIdentifierInsulinDelivery';
const HK_SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const HK_STEPS = 'HKQuantityTypeIdentifierStepCount';
const HK_ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned';

// Permission configuration
export const HEALTHKIT_PERMISSIONS = {
  permissions: {
    read: [
      HK_BLOOD_GLUCOSE,
      HK_DIETARY_CARBS,
      HK_INSULIN,
      HK_SLEEP,
      HK_STEPS,
      HK_ACTIVE_ENERGY,
    ],
    write: [
      HK_BLOOD_GLUCOSE,
      HK_DIETARY_CARBS,
    ],
  },
};

class HealthKitServiceClass {
  private initialized = false;
  private AppleHealthKit: any = null;

  /**
   * Check if HealthKit is available
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios';
  }

  /**
   * Load AppleHealthKit module dynamically
   */
  private async loadModule(): Promise<boolean> {
    if (this.AppleHealthKit) return true;
    
    try {
      // Dynamic import to avoid issues on Android
      const module = await import('react-native-health');
      this.AppleHealthKit = module.default;
      return true;
    } catch (error) {
      console.error('Failed to load react-native-health:', error);
      return false;
    }
  }

  /**
   * Initialize HealthKit and request permissions
   */
  async initialize(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    if (this.initialized) return true;

    const loaded = await this.loadModule();
    if (!loaded) return false;

    return new Promise((resolve) => {
      this.AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (error: any) => {
        if (error) {
          console.error('HealthKit init error:', error);
          resolve(false);
        } else {
          this.initialized = true;
          resolve(true);
        }
      });
    });
  }

  /**
   * Check authorization status
   */
  async checkAuthorization(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    if (!this.AppleHealthKit) {
      const loaded = await this.loadModule();
      if (!loaded) return false;
    }

    return new Promise((resolve) => {
      this.AppleHealthKit.getAuthStatus(HEALTHKIT_PERMISSIONS, (error: any, result: any) => {
        if (error) {
          resolve(false);
        } else {
          resolve(result?.permissions?.read?.includes(HK_BLOOD_GLUCOSE) || false);
        }
      });
    });
  }

  /**
   * Get glucose readings from HealthKit
   */
  async getGlucoseReadings(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<GlucoseReading[]> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ascending: false,
      limit: 1000,
    };

    return new Promise((resolve) => {
      this.AppleHealthKit.getBloodGlucoseSamples(options, (error: any, results: any[]) => {
        if (error || !results) {
          console.error('HealthKit glucose error:', error);
          resolve([]);
          return;
        }

        const readings: GlucoseReading[] = results.map((sample) => ({
          id: `hk_${sample.startDate}_${sample.value}`,
          source: 'healthkit' as const,
          timestamp: sample.startDate,
          mgdl: Math.round(sample.value),
          device: sample.sourceName || 'Apple Health',
        }));

        resolve(readings);
      });
    });
  }

  /**
   * Get carbohydrate entries
   */
  async getCarbEntries(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<Array<{ timestamp: string; carbs: number }>> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ascending: false,
      limit: 500,
    };

    return new Promise((resolve) => {
      this.AppleHealthKit.getCarbohydratesSamples(options, (error: any, results: any[]) => {
        if (error || !results) {
          resolve([]);
          return;
        }

        const entries = results.map((sample) => ({
          timestamp: sample.startDate,
          carbs: Math.round(sample.value),
        }));

        resolve(entries);
      });
    });
  }

  /**
   * Get step count for a date range
   */
  async getStepCount(startDate: Date, endDate: Date = new Date()): Promise<number> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return 0;
    }

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    return new Promise((resolve) => {
      this.AppleHealthKit.getStepCount(options, (error: any, result: any) => {
        if (error || !result) {
          resolve(0);
          return;
        }
        resolve(Math.round(result.value));
      });
    });
  }

  /**
   * Get sleep analysis
   */
  async getSleepAnalysis(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<Array<{ start: string; end: string; value: string }>> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: 100,
    };

    return new Promise((resolve) => {
      this.AppleHealthKit.getSleepSamples(options, (error: any, results: any[]) => {
        if (error || !results) {
          resolve([]);
          return;
        }

        const sleepData = results.map((sample) => ({
          start: sample.startDate,
          end: sample.endDate,
          value: sample.value,
        }));

        resolve(sleepData);
      });
    });
  }

  /**
   * Write glucose reading to HealthKit
   */
  async writeGlucoseReading(mgdl: number, date: Date = new Date()): Promise<boolean> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return false;
    }

    return new Promise((resolve) => {
      this.AppleHealthKit.saveBloodGlucoseSample(
        { value: mgdl, date: date.toISOString() },
        (error: any) => {
          if (error) {
            console.error('HealthKit write glucose error:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  /**
   * Write carbohydrate entry to HealthKit
   */
  async writeCarbEntry(carbs: number, date: Date = new Date()): Promise<boolean> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return false;
    }

    return new Promise((resolve) => {
      this.AppleHealthKit.saveCarbohydratesSample(
        { value: carbs, date: date.toISOString() },
        (error: any) => {
          if (error) {
            console.error('HealthKit write carbs error:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
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
   * Enable background delivery for glucose updates
   */
  async enableBackgroundDelivery(): Promise<boolean> {
    if (!this.initialized) return false;

    return new Promise((resolve) => {
      this.AppleHealthKit.enableBackgroundDelivery(
        HK_BLOOD_GLUCOSE,
        1, // Immediate
        (error: any) => {
          if (error) {
            console.error('Background delivery error:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }
}

export const HealthKitService = new HealthKitServiceClass();
export default HealthKitService;
