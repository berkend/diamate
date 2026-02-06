/**
 * DiaMate Home Screen
 * Shows current glucose, trends, and quick stats
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/appStore';
import { HealthManager } from '../services/health/HealthManager';
import { GlucoseReading, GlucoseTrend } from '../types';

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { profile, glucoseReadings, getTodayGlucose, getWeekStats } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [latestGlucose, setLatestGlucose] = useState<GlucoseReading | null>(null);
  const [trend, setTrend] = useState<GlucoseTrend | undefined>();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Get latest from store
    const todayReadings = getTodayGlucose();
    if (todayReadings.length > 0) {
      setLatestGlucose(todayReadings[0]);
      setTrend(HealthManager.calculateTrend(todayReadings));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await HealthManager.syncGlucoseReadings(7);
      loadData();
    } catch (error) {
      console.error('Refresh error:', error);
    }
    setRefreshing(false);
  };

  const weekStats = getWeekStats();
  const todayReadings = getTodayGlucose();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  const getGlucoseColor = (value: number) => {
    const low = profile?.targetLow || 70;
    const high = profile?.targetHigh || 180;
    if (value < low) return '#EF4444'; // Red - low
    if (value > high) return '#F59E0B'; // Orange - high
    return '#10B981'; // Green - in range
  };

  const getTrendIcon = (t?: GlucoseTrend) => {
    switch (t) {
      case 'rising_fast': return '⬆️';
      case 'rising': return '↗️';
      case 'falling_fast': return '⬇️';
      case 'falling': return '↘️';
      case 'stable': return '➡️';
      default: return '';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{profile?.name?.split(' ')[0] || 'Kullanıcı'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.avatarButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.avatar}>
              {profile?.gender === 'female' ? '👩' : '👨'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Current Glucose Card */}
        <View style={styles.glucoseCard}>
          {latestGlucose ? (
            <>
              <Text style={styles.glucoseLabel}>Güncel Glukoz</Text>
              <View style={styles.glucoseRow}>
                <Text style={[styles.glucoseValue, { color: getGlucoseColor(latestGlucose.mgdl) }]}>
                  {latestGlucose.mgdl}
                </Text>
                <Text style={styles.glucoseUnit}>mg/dL</Text>
                {trend && <Text style={styles.trendIcon}>{getTrendIcon(trend)}</Text>}
              </View>
              <Text style={styles.glucoseTime}>
                {new Date(latestGlucose.timestamp).toLocaleTimeString('tr-TR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
                {' • '}
                {latestGlucose.source === 'healthkit' ? 'Apple Health' : 
                 latestGlucose.source === 'healthconnect' ? 'Health Connect' : 
                 latestGlucose.device || 'Manuel'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.glucoseLabel}>Glukoz Verisi Yok</Text>
              <Text style={styles.noDataText}>
                Sağlık uygulamanızı bağlayın veya manuel ölçüm ekleyin
              </Text>
              <TouchableOpacity 
                style={styles.connectButton}
                onPress={() => navigation.navigate('HealthConnections')}
              >
                <Text style={styles.connectButtonText}>Sağlık Bağla</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statValue}>
              {weekStats.avgBG ? `${weekStats.avgBG}` : '-'}
            </Text>
            <Text style={styles.statLabel}>Ort. Glukoz</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statValue}>
              {weekStats.timeInRange ? `${weekStats.timeInRange}%` : '-'}
            </Text>
            <Text style={styles.statLabel}>Hedefte</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📈</Text>
            <Text style={styles.statValue}>{todayReadings.length}</Text>
            <Text style={styles.statLabel}>Bugün</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('Meal')}
          >
            <Text style={styles.actionIcon}>📸</Text>
            <Text style={styles.actionTitle}>Yemek Analizi</Text>
            <Text style={styles.actionSubtitle}>Fotoğraf çek</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.actionIcon}>🤖</Text>
            <Text style={styles.actionTitle}>AI Koç</Text>
            <Text style={styles.actionSubtitle}>Soru sor</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('Insights')}
          >
            <Text style={styles.actionIcon}>💡</Text>
            <Text style={styles.actionTitle}>Öneriler</Text>
            <Text style={styles.actionSubtitle}>Kişisel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('HealthConnections')}
          >
            <Text style={styles.actionIcon}>🔗</Text>
            <Text style={styles.actionTitle}>Bağlantılar</Text>
            <Text style={styles.actionSubtitle}>CGM & Sağlık</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Readings */}
        {todayReadings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Bugünkü Ölçümler</Text>
            <View style={styles.readingsList}>
              {todayReadings.slice(0, 5).map((reading, index) => (
                <View key={reading.id || index} style={styles.readingItem}>
                  <View style={[styles.readingDot, { backgroundColor: getGlucoseColor(reading.mgdl) }]} />
                  <Text style={styles.readingValue}>{reading.mgdl} mg/dL</Text>
                  <Text style={styles.readingTime}>
                    {new Date(reading.timestamp).toLocaleTimeString('tr-TR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    fontSize: 24,
  },
  glucoseCard: {
    margin: 20,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  glucoseLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  glucoseRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  glucoseValue: {
    fontSize: 56,
    fontWeight: '800',
  },
  glucoseUnit: {
    fontSize: 20,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  trendIcon: {
    fontSize: 28,
    marginLeft: 12,
  },
  glucoseTime: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionCard: {
    width: '48%',
    margin: '1%',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  readingsList: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
  },
  readingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  readingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  readingValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  readingTime: {
    fontSize: 14,
    color: '#6B7280',
  },
});
