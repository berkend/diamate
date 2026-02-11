/**
 * DiaMate HealthKit Service (iOS)
 * Real Apple Health integration using react-native-health
 */
import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
  HealthInputOptions,
  HealthUnit,
} from 'react-native-health';
import { GlucoseReading, GlucoseTrend } from '../../types';

// Permissions we need
const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.BloodGlucose,
      (AppleHealthKit.Constants.Permissions as any).DietaryCarbohydrates || 'DietaryCarbohydrates',
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.Weight,
      AppleHealthKit.Constants.Permissions.Height,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.BloodGlucose,
      (AppleHealthKit.Constants.Permissions as any).DietaryCarbohydrates || 'DietaryCarbohydrates',
    ],
  },
};

class HealthKitServiceClass {
  private initialized = false;

  isAvailable(): boolean {
    return Platform.OS === 'ios';
  }

  async initialize(): Promise<boolean> {
    if (!this.isAvailable()) {
      console.log('HealthKit not available on this platform');
      return false;
    }

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          console.log('HealthKit init error:', error);
          resolve(false);
        } else {
          console.log('HealthKit initialized successfully');
          this.initialized = true;
          resolve(true);
        }
      });
    });
  }

  async checkAuthorization(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    
    return new Promise((resolve) => {
      AppleHealthKit.getAuthStatus(permissions, (error: any, result: any) => {
        if (error) {
          resolve(false);
        } else {
          resolve(result?.permissions?.read?.includes('BloodGlucose') ?? false);
        }
      });
    });
  }

  async getGlucoseReadings(startDate: Date, endDate?: Date): Promise<GlucoseReading[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() || new Date().toISOString(),
      ascending: false,
      limit: 100,
    };

    return new Promise((resolve) => {
      AppleHealthKit.getBloodGlucoseSamples(options, (error: string, results: HealthValue[]) => {
        if (error) {
          console.log('Error getting glucose:', error);
          resolve([]);
        } else {
          const readings: GlucoseReading[] = (results || []).map((sample: any, index: number) => ({
            id: `hk-${index}-${sample.startDate}`,
            mgdl: Math.round(sample.value * 18),
            timestamp: sample.startDate,
            source: sample.sourceName || 'Apple Health',
          }));
          resolve(readings);
        }
      });
    });
  }

  async getLatestGlucose(): Promise<GlucoseReading | null> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const readings = await this.getGlucoseReadings(dayAgo, now);
    return readings.length > 0 ? readings[0] : null;
  }

  async writeGlucoseReading(mgdl: number, date?: Date): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const options = {
      value: mgdl,
      date: (date || new Date()).toISOString(),
      unit: 'mg/dL' as HealthUnit,
    };

    return new Promise((resolve) => {
      AppleHealthKit.saveBloodGlucoseSample(options, (error: string) => {
        if (error) {
          console.log('Error saving glucose:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async getCarbEntries(startDate: Date, endDate?: Date): Promise<Array<{ timestamp: string; carbs: number }>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() || new Date().toISOString(),
      ascending: false,
    };

    return new Promise((resolve) => {
      AppleHealthKit.getCarbohydratesSamples(options, (error: string, results: HealthValue[]) => {
        if (error) {
          console.log('Error getting carbs:', error);
          resolve([]);
        } else {
          const entries = (results || []).map((sample) => ({
            timestamp: sample.startDate,
            carbs: sample.value,
          }));
          resolve(entries);
        }
      });
    });
  }

  async writeCarbEntry(carbs: number, date?: Date): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const options = {
      value: carbs,
      date: (date || new Date()).toISOString(),
    };

    return new Promise((resolve) => {
      AppleHealthKit.saveCarbohydratesSample(options, (error: string) => {
        if (error) {
          console.log('Error saving carbs:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async getStepCount(startDate: Date, endDate?: Date): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() || new Date().toISOString(),
    };

    return new Promise((resolve) => {
      AppleHealthKit.getStepCount(options, (error: string, results: { value: number }) => {
        if (error) {
          console.log('Error getting steps:', error);
          resolve(0);
        } else {
          resolve(results?.value || 0);
        }
      });
    });
  }

  async getSleepAnalysis(startDate: Date, endDate?: Date): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() || new Date().toISOString(),
    };

    return new Promise((resolve) => {
      AppleHealthKit.getSleepSamples(options, (error: string, results: any[]) => {
        if (error) {
          console.log('Error getting sleep:', error);
          resolve([]);
        } else {
          resolve(results || []);
        }
      });
    });
  }

  calculateTrend(readings: GlucoseReading[]): GlucoseTrend | undefined {
    if (readings.length < 2) return undefined;
    
    const sorted = [...readings].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const latest = sorted[0].mgdl;
    const previous = sorted[1].mgdl;
    const diff = latest - previous;
    
    if (diff > 15) return 'rising_fast';
    if (diff > 5) return 'rising';
    if (diff < -15) return 'falling_fast';
    if (diff < -5) return 'falling';
    return 'stable';
  }
}

export const HealthKitService = new HealthKitServiceClass();
export default HealthKitService;
