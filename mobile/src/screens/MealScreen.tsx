/**
 * DiaMate Meal Screen
 * AI-powered food photo analysis
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/appStore';
import { analyzePhoto } from '../services/api';
import { MealItem, MealLog } from '../types';

export function MealScreen() {
  const navigation = useNavigation<any>();
  const { entitlement, addMealLog, language } = useAppStore();
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    items: MealItem[];
    totalCarbs: number;
    notes: string;
    confidence: string;
  } | null>(null);
  const [editedCarbs, setEditedCarbs] = useState<number>(0);

  const pickImage = async (useCamera: boolean) => {
    // Check PRO for vision
    if (!entitlement.isPro && entitlement.usage.dailyVisionCount >= entitlement.quotas.visionPerDay) {
      navigation.navigate('Paywall', { source: 'meal_analysis' });
      return;
    }

    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera izni gerekli.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          quality: 0.8,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          base64: true,
        });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      analyzeImage(result.assets[0].base64!);
    }
  };

  const analyzeImage = async (base64: string) => {
    setAnalyzing(true);
    setResult(null);

    try {
      const response = await analyzePhoto({
        imageBase64: `data:image/jpeg;base64,${base64}`,
        lang: language,
      });

      if (response.error) {
        if (response.error === 'pro_required') {
          navigation.navigate('Paywall', { source: 'meal_analysis' });
          return;
        }
        Alert.alert('Hata', response.notes || 'Analiz başarısız oldu.');
        return;
      }

      setResult({
        items: response.items,
        totalCarbs: response.total_carbs_g,
        notes: response.notes,
        confidence: response.confidence,
      });
      setEditedCarbs(response.total_carbs_g);
    } catch (error) {
      Alert.alert('Hata', 'Fotoğraf analizi başarısız oldu. Tekrar deneyin.');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveMeal = () => {
    if (!result) return;

    const meal: MealLog = {
      id: `meal_${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: result.items,
      totalCarbs: editedCarbs,
      photoUsed: true,
      notes: result.notes,
    };

    addMealLog(meal);
    Alert.alert('Kaydedildi', 'Öğün başarıyla kaydedildi.');
    resetScreen();
  };

  const resetScreen = () => {
    setImage(null);
    setResult(null);
    setEditedCarbs(0);
  };

  const getConfidenceText = (conf: string) => {
    switch (conf) {
      case 'high': return 'Yüksek';
      case 'medium': return 'Orta';
      case 'low': return 'Düşük';
      default: return conf;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🤖 AI Yemek Analizi</Text>
          <Text style={styles.subtitle}>
            Yemeğinizin fotoğrafını çekin, AI karbonhidrat miktarını tahmin etsin.
          </Text>
        </View>

        {!image ? (
          /* Upload Section */
          <View style={styles.uploadSection}>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickImage(true)}
            >
              <Text style={styles.uploadIcon}>📸</Text>
              <Text style={styles.uploadTitle}>Fotoğraf Çek</Text>
              <Text style={styles.uploadSubtitle}>Kamerayı kullan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickImage(false)}
            >
              <Text style={styles.uploadIcon}>🖼️</Text>
              <Text style={styles.uploadTitle}>Galeriden Seç</Text>
              <Text style={styles.uploadSubtitle}>Mevcut fotoğraf</Text>
            </TouchableOpacity>

            {!entitlement.isPro && (
              <View style={styles.proNotice}>
                <Text style={styles.proNoticeText}>
                  🔒 Fotoğraf analizi PRO özelliğidir
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Paywall', { source: 'meal_screen' })}
                >
                  <Text style={styles.proNoticeLink}>PRO'ya Yükselt</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* Result Section */
          <View style={styles.resultSection}>
            {/* Image Preview */}
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeButton} onPress={resetScreen}>
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {analyzing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16A34A" />
                <Text style={styles.loadingText}>AI Analiz Ediyor...</Text>
                <Text style={styles.loadingSubtext}>Yemekler tanınıyor</Text>
              </View>
            ) : result ? (
              <>
                {/* Total Carbs */}
                <View style={styles.totalCard}>
                  <Text style={styles.totalLabel}>Toplam Karbonhidrat</Text>
                  <View style={styles.totalRow}>
                    <TextInput
                      style={styles.totalInput}
                      value={String(editedCarbs)}
                      onChangeText={(text) => setEditedCarbs(parseInt(text) || 0)}
                      keyboardType="numeric"
                    />
                    <Text style={styles.totalUnit}>g</Text>
                  </View>
                  <Text style={styles.confidenceText}>
                    Güven: {getConfidenceText(result.confidence)}
                  </Text>
                </View>

                {/* Notes */}
                {result.notes && (
                  <View style={styles.notesCard}>
                    <Text style={styles.notesText}>💡 {result.notes}</Text>
                  </View>
                )}

                {/* Detected Items */}
                <View style={styles.itemsCard}>
                  <Text style={styles.itemsTitle}>Tespit Edilen Yemekler</Text>
                  {result.items.length === 0 ? (
                    <Text style={styles.noItemsText}>Yemek tespit edilemedi</Text>
                  ) : (
                    result.items.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <Text style={styles.itemPortion}>
                            {item.portion} • {getConfidenceText(item.confidence || 'medium')}
                          </Text>
                        </View>
                        <Text style={styles.itemCarbs}>{item.carbs_g}g</Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.saveButton} onPress={saveMeal}>
                    <Text style={styles.saveButtonText}>💾 Öğün Kaydet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.retryButton} onPress={resetScreen}>
                    <Text style={styles.retryButtonText}>🔄 Yeni Fotoğraf</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  uploadSection: {
    padding: 20,
  },
  uploadButton: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  proNotice: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  proNoticeText: {
    fontSize: 14,
    color: '#92400E',
  },
  proNoticeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  resultSection: {
    padding: 20,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  totalCard: {
    backgroundColor: '#16A34A',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalInput: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 100,
    textAlign: 'center',
  },
  totalUnit: {
    fontSize: 24,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  confidenceText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  notesCard: {
    backgroundColor: '#E0F2FE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  notesText: {
    fontSize: 14,
    color: '#0369A1',
    lineHeight: 20,
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  noItemsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    padding: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemPortion: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  itemCarbs: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16A34A',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
