/**
 * DiaMate Health Manager
 * Unified interface for iOS HealthKit and Android Health Connect
 */
import { Platform } from 'react-native';
import { HealthKitService } from './HealthKitService';
import { HealthConnectService } from './HealthConnectService';
import { GlucoseReading, GlucoseTrend, HealthConnection, HealthProvider } from '../../types';
import { useAppStore } from '../../store/appStore';

class HealthManagerClass {
  private initialized = false;

  /**
   * Get the appropriate health service for current platform
   */
  private getService() {
    return Platform.OS === 'ios' ? HealthKitService : HealthConnectService;
  }

  /**
   * Get current platform's health provider name
   */
  getProviderName(): HealthProvider {
    return Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
  }

  /**
   * Check if health integration is available
   */
  isAvailable(): boolean {
    return this.getService().isAvailable();
  }

  /**
   * Initialize health service and request permissions
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    const service = this.getService();
    if (!service.isAvailable()) return false;

    const success = await service.initialize();
    this.initialized = success;
    return success;
  }

  /**
   * Request health permissions
   */
  async requestPermissions(): Promise<boolean> {
    const service = this.getService();
    
    if (Platform.OS === 'ios') {
      return await (service as typeof HealthKitService).initialize();
    } else {
      return await (service as typeof HealthConnectService).requestPermissions();
    }
  }

  /**
   * Check if permissions are granted
   */
  async checkPermissions(): Promise<boolean> {
    const service = this.getService();
    
    if (Platform.OS === 'ios') {
      return await (service as typeof HealthKitService).checkAuthorization();
    } else {
      return await (service as typeof HealthConnectService).checkPermissions();
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<HealthConnection> {
    const provider = this.getProviderName();
    const connected = await this.checkPermissions();
    const store = useAppStore.getState();

    return {
      provider,
      connected,
      lastSync: store.lastHealthSync || undefined,
      permissions: connected ? ['blood_glucose', 'nutrition', 'activity', 'sleep'] : [],
    };
  }

  /**
   * Sync glucose readings from health platform
   */
  async syncGlucoseReadings(days: number = 7): Promise<GlucoseReading[]> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await this.getService().getGlucoseReadings(startDate);
    
    // Update store
    if (readings.length > 0) {
      useAppStore.getState().syncHealthData(readings);
    }

    return readings;
  }

  /**
   * Get glucose readings
   */
  async getGlucoseReadings(startDate: Date, endDate?: Date): Promise<GlucoseReading[]> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    return await this.getService().getGlucoseReadings(startDate, endDate);
  }

  /**
   * Get latest glucose reading
   */
  async getLatestGlucose(): Promise<GlucoseReading | null> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return null;
    }

    return await this.getService().getLatestGlucose();
  }

  /**
   * Write glucose reading
   */
  async writeGlucoseReading(mgdl: number, date?: Date): Promise<boolean> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return false;
    }

    return await this.getService().writeGlucoseReading(mgdl, date);
  }

  /**
   * Get carbohydrate entries
   */
  async getCarbEntries(startDate: Date, endDate?: Date): Promise<Array<{ timestamp: string; carbs: number }>> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    if (Platform.OS === 'ios') {
      return await (this.getService() as typeof HealthKitService).getCarbEntries(startDate, endDate);
    } else {
      return await (this.getService() as typeof HealthConnectService).getNutritionEntries(startDate, endDate);
    }
  }

  /**
   * Write carbohydrate entry
   */
  async writeCarbEntry(carbs: number, date?: Date): Promise<boolean> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return false;
    }

    if (Platform.OS === 'ios') {
      return await (this.getService() as typeof HealthKitService).writeCarbEntry(carbs, date);
    } else {
      return await (this.getService() as typeof HealthConnectService).writeNutritionEntry(carbs, date);
    }
  }

  /**
   * Get step count
   */
  async getStepCount(startDate: Date, endDate?: Date): Promise<number> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return 0;
    }

    return await this.getService().getStepCount(startDate, endDate);
  }

  /**
   * Get sleep data
   */
  async getSleepData(startDate: Date, endDate?: Date): Promise<any[]> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    if (Platform.OS === 'ios') {
      return await (this.getService() as typeof HealthKitService).getSleepAnalysis(startDate, endDate);
    } else {
      return await (this.getService() as typeof HealthConnectService).getSleepSessions(startDate, endDate);
    }
  }

  /**
   * Calculate glucose trend
   */
  calculateTrend(readings: GlucoseReading[]): GlucoseTrend | undefined {
    return this.getService().calculateTrend(readings);
  }

  /**
   * Get health summary for AI context
   */
  async getHealthSummary(): Promise<object> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [glucoseReadings, carbEntries, steps, sleep] = await Promise.all([
      this.getGlucoseReadings(weekAgo),
      this.getCarbEntries(weekAgo),
      this.getStepCount(weekAgo),
      this.getSleepData(weekAgo),
    ]);

    const store = useAppStore.getState();
    const profile = store.profile;

    if (glucoseReadings.length === 0) {
      return { hasData: false };
    }

    const values = glucoseReadings.map(r => r.mgdl);
    const avgBG = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const targetLow = profile?.targetLow || 70;
    const targetHigh = profile?.targetHigh || 180;
    const inRange = values.filter(v => v >= targetLow && v <= targetHigh);
    const timeInRange = Math.round((inRange.length / values.length) * 100);

    return {
      hasData: true,
      period: '7_days',
      glucose: {
        average: avgBG,
        min: Math.min(...values),
        max: Math.max(...values),
        timeInRange,
        hypoCount: values.filter(v => v < 70).length,
        hyperCount: values.filter(v => v > 250).length,
        readingsCount: values.length,
      },
      nutrition: {
        mealsLogged: carbEntries.length,
        avgCarbsPerMeal: carbEntries.length > 0 
          ? Math.round(carbEntries.reduce((a, b) => a + b.carbs, 0) / carbEntries.length)
          : 0,
      },
      activity: {
        totalSteps: steps,
        avgDailySteps: Math.round(steps / 7),
      },
      sleep: {
        sessionsLogged: sleep.length,
      },
    };
  }

  /**
   * Disconnect health integration
   */
  async disconnect(): Promise<void> {
    this.initialized = false;
    // Note: Can't programmatically revoke permissions
    // User must do this in system settings
    
    if (Platform.OS === 'android') {
      await (this.getService() as typeof HealthConnectService).openHealthConnectSettings();
    }
  }
}

export const HealthManager = new HealthManagerClass();
export default HealthManager;
