/**
 * DiaMate Health Connections Screen
 * Manage Apple Health, Health Connect, and CGM connections
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { HealthManager } from '../services/health/HealthManager';
import { useAppStore } from '../store/appStore';
import { HealthConnection } from '../types';

export function HealthConnectionsScreen() {
  const navigation = useNavigation();
  const { lastHealthSync } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connection, setConnection] = useState<HealthConnection | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    const status = await HealthManager.getConnectionStatus();
    setConnection(status);
    setLoading(false);
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const granted = await HealthManager.requestPermissions();
      if (granted) {
        await HealthManager.syncGlucoseReadings(30);
        Alert.alert('Başarılı', 'Sağlık verileri bağlandı!');
      } else {
        Alert.alert('İzin Gerekli', 'Sağlık verilerine erişim izni verilmedi.');
      }
      await checkConnection();
    } catch (error) {
      Alert.alert('Hata', 'Bağlantı kurulamadı.');
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const readings = await HealthManager.syncGlucoseReadings(7);
      Alert.alert('Senkronize Edildi', `${readings.length} yeni ölçüm alındı.`);
    } catch (error) {
      Alert.alert('Hata', 'Senkronizasyon başarısız.');
    }
    setSyncing(false);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Bağlantıyı Kes',
      'Sağlık uygulaması bağlantısını kesmek için sistem ayarlarına yönlendirileceksiniz.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Ayarlara Git', onPress: () => HealthManager.disconnect() },
      ]
    );
  };

  const providerName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
  const providerIcon = Platform.OS === 'ios' ? '🍎' : '💚';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🔗 Sağlık Bağlantıları</Text>
          <Text style={styles.subtitle}>
            Glukoz verilerinizi otomatik olarak senkronize edin
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#667eea" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>{providerIcon}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{providerName}</Text>
                  <Text style={styles.cardStatus}>
                    {connection?.connected ? '✓ Bağlı' : 'Bağlı Değil'}
                  </Text>
                </View>
              </View>

              {connection?.connected ? (
                <>
                  <View style={styles.permissionsList}>
                    {connection.permissions.map((perm, i) => (
                      <View key={i} style={styles.permissionItem}>
                        <Text style={styles.permissionCheck}>✓</Text>
                        <Text style={styles.permissionText}>{perm}</Text>
                      </View>
                    ))}
                  </View>
                  {lastHealthSync && (
                    <Text style={styles.lastSync}>
                      Son senkronizasyon: {new Date(lastHealthSync).toLocaleString('tr-TR')}
                    </Text>
                  )}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.syncButton, syncing && styles.buttonDisabled]}
                      onPress={handleSync}
                      disabled={syncing}
                    >
                      <Text style={styles.syncButtonText}>
                        {syncing ? 'Senkronize Ediliyor...' : '🔄 Senkronize Et'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
                      <Text style={styles.disconnectButtonText}>Bağlantıyı Kes</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.description}>
                    {Platform.OS === 'ios'
                      ? 'Apple Health ile bağlanarak CGM cihazınızdan (Dexcom, Libre vb.) gelen glukoz verilerini otomatik olarak DiaMate\'e aktarın.'
                      : 'Health Connect ile bağlanarak CGM cihazınızdan gelen glukoz verilerini otomatik olarak DiaMate\'e aktarın.'}
                  </Text>
                  <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
                    <Text style={styles.connectButtonText}>Bağlan</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>📟 CGM Entegrasyonu</Text>
              <Text style={styles.infoText}>
                Dexcom, Libre ve diğer CGM cihazları {providerName}'e veri yazıyorsa, 
                DiaMate bu verileri otomatik olarak okuyabilir. Doğrudan CGM bağlantısı 
                için gelecek güncellemeleri takip edin.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollView: { flex: 1 },
  header: { padding: 20 },
  backButton: { marginBottom: 16 },
  backButtonText: { fontSize: 16, color: '#667eea', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280' },
  card: { margin: 20, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardIcon: { fontSize: 40, marginRight: 16 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  cardStatus: { fontSize: 14, color: '#10B981', marginTop: 4 },
  permissionsList: { marginBottom: 16 },
  permissionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  permissionCheck: { fontSize: 14, color: '#10B981', marginRight: 8 },
  permissionText: { fontSize: 14, color: '#4B5563' },
  lastSync: { fontSize: 12, color: '#9CA3AF', marginBottom: 16 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  syncButton: { flex: 1, backgroundColor: '#667eea', padding: 14, borderRadius: 12, alignItems: 'center' },
  syncButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  disconnectButton: { flex: 1, backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, alignItems: 'center' },
  disconnectButtonText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  description: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  connectButton: { backgroundColor: '#667eea', padding: 16, borderRadius: 12, alignItems: 'center' },
  connectButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  infoCard: { margin: 20, marginTop: 0, backgroundColor: '#EFF6FF', borderRadius: 16, padding: 20 },
  infoTitle: { fontSize: 16, fontWeight: '600', color: '#1E40AF', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#3B82F6', lineHeight: 20 },
});
