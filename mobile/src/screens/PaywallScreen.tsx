/**
 * DiaMate Paywall Screen
 * PRO subscription purchase flow
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getPackages, purchasePackage, restorePurchases } from '../services/purchases';
import { useAppStore } from '../store/appStore';

interface Package {
  identifier: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    price?: number;
  };
}

export function PaywallScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { entitlement } = useAppStore();
  
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    // Close if already PRO
    if (entitlement.isPro) {
      navigation.goBack();
    }
  }, [entitlement.isPro]);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const pkgs = await getPackages();
      setPackages(pkgs);
      // Select yearly by default (better value)
      const yearly = pkgs.find(p => p.identifier.includes('yearly'));
      setSelectedPackage(yearly || pkgs[0] || null);
    } catch (error) {
      console.error('Failed to load packages:', error);
    }
    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    
    setPurchasing(true);
    try {
      const result = await purchasePackage(selectedPackage);
      if (result.success) {
        Alert.alert('Başarılı! 🎉', 'PRO aboneliğiniz aktif edildi!', [
          { text: 'Harika!', onPress: () => navigation.goBack() }
        ]);
      } else if (result.error !== 'cancelled') {
        Alert.alert('Hata', result.error || 'Satın alma başarısız oldu.');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bir hata oluştu. Tekrar deneyin.');
    }
    setPurchasing(false);
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const result = await restorePurchases();
      if (result.success && result.isPro) {
        Alert.alert('Başarılı!', 'Aboneliğiniz geri yüklendi!', [
          { text: 'Harika!', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Bilgi', 'Aktif abonelik bulunamadı.');
      }
    } catch (error) {
      Alert.alert('Hata', 'Geri yükleme başarısız oldu.');
    }
    setPurchasing(false);
  };

  const features = [
    { icon: '🤖', title: 'Sınırsız AI Sohbet', description: 'Günde 500 mesaj' },
    { icon: '📸', title: 'Fotoğraf Analizi', description: 'Günde 200 analiz' },
    { icon: '💡', title: 'Gelişmiş Öneriler', description: 'Kişiselleştirilmiş içgörüler' },
    { icon: '📊', title: 'Detaylı Raporlar', description: 'Haftalık ve aylık analizler' },
    { icon: '🔔', title: 'Akıllı Hatırlatmalar', description: 'Kişiselleştirilmiş bildirimler' },
    { icon: '☁️', title: 'Bulut Yedekleme', description: 'Verileriniz güvende' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.badge}>⭐ PRO</Text>
          <Text style={styles.title}>DiaMate PRO</Text>
          <Text style={styles.subtitle}>
            Diyabet yönetiminizi bir üst seviyeye taşıyın
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
              <Text style={styles.featureCheck}>✓</Text>
            </View>
          ))}
        </View>

        {/* Packages */}
        {loading ? (
          <ActivityIndicator size="large" color="#667eea" style={{ marginVertical: 40 }} />
        ) : (
          <View style={styles.packagesContainer}>
            {packages.map((pkg) => {
              const isYearly = pkg.identifier.includes('yearly');
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  {isYearly && (
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveBadgeText}>%40 Tasarruf</Text>
                    </View>
                  )}
                  <View style={styles.packageHeader}>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.packageTitle}>
                      {isYearly ? 'Yıllık' : 'Aylık'}
                    </Text>
                  </View>
                  <Text style={styles.packagePrice}>
                    {pkg.product.priceString}
                    <Text style={styles.packagePeriod}>
                      /{isYearly ? 'yıl' : 'ay'}
                    </Text>
                  </Text>
                  {isYearly && (
                    <Text style={styles.packageMonthly}>
                      Aylık sadece {(pkg.product.price / 12).toFixed(2)} ₺
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Purchase Button */}
        <TouchableOpacity
          style={[styles.purchaseButton, purchasing && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={purchasing || !selectedPackage}
        >
          {purchasing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.purchaseButtonText}>
              PRO'ya Yükselt
            </Text>
          )}
        </TouchableOpacity>

        {/* Restore */}
        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
          <Text style={styles.restoreButtonText}>Satın Alımları Geri Yükle</Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.terms}>
          Abonelik otomatik olarak yenilenir. İstediğiniz zaman iptal edebilirsiniz.
          Satın alma işlemi App Store / Google Play hesabınızdan tahsil edilir.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  badge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  featuresContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  featureDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  featureCheck: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: '600',
  },
  packagesContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  packageCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    position: 'relative',
  },
  packageCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#EEF2FF',
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  saveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#667eea',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#667eea',
  },
  packageTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  packagePrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
  },
  packagePeriod: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6B7280',
  },
  packageMonthly: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  purchaseButton: {
    marginHorizontal: 24,
    backgroundColor: '#667eea',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  terms: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 16,
  },
});
