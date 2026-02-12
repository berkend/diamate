/**
 * DiaMate Settings Screen
 * User preferences, AI personalization, subscription management
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/appStore';
import { signOut, deleteAccount } from '../services/supabase';
import { restorePurchases, getManageSubscriptionUrl } from '../services/purchases';

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const {
    profile,
    entitlement,
    userId,
    aiPersonalizationEnabled,
    toggleAIPersonalization,
    clearAIMemory,
    logout,
  } = useAppStore();
  
  const [loading, setLoading] = useState(false);

  const handleRestorePurchases = async () => {
    setLoading(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        Alert.alert(
          'Başarılı',
          result.isPro 
            ? 'PRO aboneliğiniz geri yüklendi!' 
            : 'Aktif abonelik bulunamadı.'
        );
      } else {
        Alert.alert('Hata', result.error || 'Geri yükleme başarısız.');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bir hata oluştu.');
    }
    setLoading(false);
  };

  const handleManageSubscription = () => {
    Linking.openURL(getManageSubscriptionUrl());
  };

  const handleClearMemory = () => {
    Alert.alert(
      'AI Hafızasını Temizle',
      'AI\'ın sizinle ilgili öğrendiği tüm bilgiler silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: () => {
            clearAIMemory();
            Alert.alert('Başarılı', 'AI hafızası temizlendi.');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabınız ve tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabı Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              if (userId) {
                await deleteAccount(userId);
                logout();
              }
            } catch (error) {
              Alert.alert('Hata', 'Hesap silinemedi.');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          onPress: async () => {
            try {
              await signOut();
              logout();
            } catch (error) {
              console.error('Sign out error:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ Ayarlar</Text>
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil</Text>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>
                  {profile?.gender === 'female' ? '👩' : '👨'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile?.name || 'Kullanıcı'}</Text>
                <Text style={styles.profileDetail}>
                  {profile?.diabetesType === 'T1' ? 'Tip 1' : 
                   profile?.diabetesType === 'T2' ? 'Tip 2' : 
                   profile?.diabetesType} Diyabet
                </Text>
              </View>
              <TouchableOpacity style={styles.editButton}>
                <Text style={styles.editButtonText}>Düzenle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abonelik</Text>
          <View style={styles.card}>
            <View style={styles.subscriptionRow}>
              <View>
                <Text style={styles.planName}>
                  {entitlement.isPro ? '⭐ PRO Plan' : '🆓 Ücretsiz Plan'}
                </Text>
                <Text style={styles.planDetail}>
                  {entitlement.isPro 
                    ? `Geçerlilik: ${entitlement.expiresAt ? new Date(entitlement.expiresAt).toLocaleDateString('tr-TR') : 'Süresiz'}`
                    : `${entitlement.quotas.chatPerDay} mesaj/gün`}
                </Text>
              </View>
              {!entitlement.isPro && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('Paywall', { source: 'settings' })}
                >
                  <Text style={styles.upgradeButtonText}>PRO'ya Yükselt</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.divider} />
            
            <TouchableOpacity style={styles.menuItem} onPress={handleRestorePurchases} disabled={loading}>
              <Text style={styles.menuItemText}>
                {loading ? 'Yükleniyor...' : 'Satın Alımları Geri Yükle'}
              </Text>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
            
            {entitlement.isPro && (
              <TouchableOpacity style={styles.menuItem} onPress={handleManageSubscription}>
                <Text style={styles.menuItemText}>Aboneliği Yönet</Text>
                <Text style={styles.menuItemArrow}>→</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Health Connections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sağlık Bağlantıları</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('HealthConnections')}
            >
              <Text style={styles.menuItemText}>🔗 Sağlık Uygulamaları</Text>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Personalization */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Kişiselleştirme</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Kişiselleştirilmiş Öneriler</Text>
                <Text style={styles.switchDescription}>
                  AI, verilerinizi kullanarak daha iyi öneriler sunar
                </Text>
              </View>
              <Switch
                value={aiPersonalizationEnabled}
                onValueChange={toggleAIPersonalization}
                trackColor={{ false: '#D1D5DB', true: '#16A34A' }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            <View style={styles.divider} />
            
            <TouchableOpacity style={styles.menuItem} onPress={handleClearMemory}>
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>
                🗑️ AI Hafızasını Temizle
              </Text>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy & Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gizlilik & Veri</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://diamate.org/privacy')}>
              <Text style={styles.menuItemText}>📄 Gizlilik Politikası</Text>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('https://diamate.org/terms')}>
              <Text style={styles.menuItemText}>📋 Kullanım Koşulları</Text>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>📥 Verilerimi İndir</Text>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>
                ⚠️ Hesabımı Sil
              </Text>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>DiaMate v1.0.0</Text>
        </View>

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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  profileDetail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  planDetail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  upgradeButton: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemText: {
    fontSize: 15,
    color: '#1F2937',
  },
  menuItemArrow: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  switchInfo: {
    flex: 1,
    marginRight: 12,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  switchDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  signOutButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
