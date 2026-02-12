/**
 * DiaMate Meal Screen
 * AI-powered food photo analysis with full macro breakdown
 * Inspired by Zinde AI's speed + DiaMate's diabetes-specific intelligence
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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/appStore';
import { analyzePhoto } from '../services/api';
import { MealItem, MealLog, FavoriteMeal } from '../types';

type Tab = 'photo' | 'favorites';

export function MealScreen() {
  const navigation = useNavigation<any>();
  const { entitlement, addMealLog, favoriteMeals, addFavoriteMeal, useFavoriteMeal, removeFavoriteMeal, language } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('photo');
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    items: MealItem[];
    totalCarbs: number;
    totalCalories: number;
    totalProtein: number;
    totalFat: number;
    totalFiber: number;
    glycemicImpact: string;
    notes: string;
    confidence: string;
  } | null>(null);
  const [editedCarbs, setEditedCarbs] = useState<number>(0);

  const pickImage = async (useCamera: boolean) => {
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

    const pickerResult = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: true });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      setImage(pickerResult.assets[0].uri);
      analyzeImage(pickerResult.assets[0].base64!);
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
        totalCalories: response.total_calories || 0,
        totalProtein: response.total_protein_g || 0,
        totalFat: response.total_fat_g || 0,
        totalFiber: response.total_fiber_g || 0,
        glycemicImpact: response.glycemicImpact || 'medium',
        notes: response.notes,
        confidence: response.confidence,
      });
      setEditedCarbs(response.total_carbs_g);
    } catch {
      Alert.alert('Hata', 'Fotoğraf analizi başarısız oldu. Tekrar deneyin.');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveMeal = (asFavorite?: boolean) => {
    if (!result) return;
    const meal: MealLog = {
      id: `meal_${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: result.items,
      totalCarbs: editedCarbs,
      totalCalories: result.totalCalories,
      totalProtein: result.totalProtein,
      totalFat: result.totalFat,
      totalFiber: result.totalFiber,
      glycemicImpact: result.glycemicImpact as any,
      photoUsed: true,
      notes: result.notes,
    };
    addMealLog(meal);

    if (asFavorite) {
      const favName = result.items.map(i => i.name).join(', ');
      addFavoriteMeal({
        id: `fav_${Date.now()}`,
        name: favName.length > 40 ? favName.substring(0, 40) + '...' : favName,
        items: result.items,
        totalCarbs: editedCarbs,
        totalCalories: result.totalCalories,
        totalProtein: result.totalProtein,
        totalFat: result.totalFat,
        createdAt: new Date().toISOString(),
        usageCount: 0,
      });
      Alert.alert('Kaydedildi', 'Öğün kaydedildi ve favorilere eklendi ⭐');
    } else {
      Alert.alert('Kaydedildi', 'Öğün başarıyla kaydedildi.');
    }
    resetScreen();
  };

  const logFavorite = (fav: FavoriteMeal) => {
    const meal: MealLog = {
      id: `meal_${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: fav.items,
      totalCarbs: fav.totalCarbs,
      totalCalories: fav.totalCalories,
      totalProtein: fav.totalProtein,
      totalFat: fav.totalFat,
      photoUsed: false,
      notes: `Favori: ${fav.name}`,
    };
    addMealLog(meal);
    useFavoriteMeal(fav.id);
    Alert.alert('Kaydedildi', `"${fav.name}" öğün olarak eklendi.`);
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

  const getGIColor = (gi?: string) => {
    switch (gi) {
      case 'low': return '#16A34A';
      case 'medium': return '#F59E0B';
      case 'high': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getGIText = (gi?: string) => {
    switch (gi) {
      case 'low': return 'Düşük GI';
      case 'medium': return 'Orta GI';
      case 'high': return 'Yüksek GI ⚠️';
      default: return '';
    }
  };

  const renderMacroCard = () => {
    if (!result) return null;
    return (
      <View style={styles.macroContainer}>
        <View style={styles.macroRow}>
          <View style={[styles.macroBox, { backgroundColor: '#FEF3C7' }]}>  
            <Text style={styles.macroValue}>{result.totalCalories}</Text>
            <Text style={styles.macroLabel}>Kalori</Text>
            <Text style={styles.macroIcon}>🔥</Text>
          </View>
          <View style={[styles.macroBox, { backgroundColor: '#DCFCE7' }]}>  
            <Text style={styles.macroValue}>{editedCarbs}g</Text>
            <Text style={styles.macroLabel}>Karbonhidrat</Text>
            <Text style={styles.macroIcon}>🍞</Text>
          </View>
        </View>
        <View style={styles.macroRow}>
          <View style={[styles.macroBox, { backgroundColor: '#FEE2E2' }]}>  
            <Text style={styles.macroValue}>{result.totalProtein}g</Text>
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroIcon}>🥩</Text>
          </View>
          <View style={[styles.macroBox, { backgroundColor: '#E0E7FF' }]}>  
            <Text style={styles.macroValue}>{result.totalFat}g</Text>
            <Text style={styles.macroLabel}>Yağ</Text>
            <Text style={styles.macroIcon}>🫒</Text>
          </View>
        </View>
        {result.totalFiber > 0 && (
          <View style={styles.fiberRow}>
            <Text style={styles.fiberText}>🌾 Lif: {result.totalFiber}g</Text>
          </View>
        )}
      </View>
    );
  };

  const renderGlycemicBadge = () => {
    if (!result?.glycemicImpact) return null;
    const color = getGIColor(result.glycemicImpact);
    return (
      <View style={[styles.giBadge, { backgroundColor: color + '15', borderColor: color }]}>
        <Text style={[styles.giBadgeText, { color }]}>
          {result.glycemicImpact === 'low' && '✅ Düşük Glisemik Etki — Kan şekerinizi yavaş yükseltir'}
          {result.glycemicImpact === 'medium' && '⚡ Orta Glisemik Etki — Kan şekerinizi orta hızda yükseltir'}
          {result.glycemicImpact === 'high' && '⚠️ Yüksek Glisemik Etki — Kan şekerinizi hızla yükseltebilir'}
        </Text>
      </View>
    );
  };

  const renderFavorites = () => {
    const sorted = [...favoriteMeals].sort((a, b) => b.usageCount - a.usageCount);
    if (sorted.length === 0) {
      return (
        <View style={styles.emptyFavorites}>
          <Text style={styles.emptyIcon}>⭐</Text>
          <Text style={styles.emptyTitle}>Henüz favori öğün yok</Text>
          <Text style={styles.emptySubtitle}>
            Fotoğraf analizi yaptıktan sonra "Favorilere Ekle" ile sık yediğiniz öğünleri kaydedin.
            Bir sonraki seferde tek dokunuşla ekleyin.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.favoritesContainer}>
        <Text style={styles.favoritesTitle}>Sık Yenen Öğünler</Text>
        <Text style={styles.favoritesSubtitle}>Tek dokunuşla öğün kaydet — fotoğraf çekmeye gerek yok</Text>
        {sorted.map((fav) => (
          <TouchableOpacity key={fav.id} style={styles.favoriteCard} onPress={() => logFavorite(fav)}>
            <View style={styles.favoriteInfo}>
              <Text style={styles.favoriteName}>{fav.name}</Text>
              <Text style={styles.favoriteMacros}>
                {fav.totalCalories ? `${fav.totalCalories} kcal • ` : ''}{fav.totalCarbs}g KH
                {fav.totalProtein ? ` • ${fav.totalProtein}g P` : ''}
                {fav.totalFat ? ` • ${fav.totalFat}g Y` : ''}
              </Text>
              <Text style={styles.favoriteUsage}>{fav.usageCount}x kullanıldı</Text>
            </View>
            <TouchableOpacity
              style={styles.favoriteDelete}
              onPress={() => {
                Alert.alert('Sil', `"${fav.name}" favorilerden silinsin mi?`, [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Sil', style: 'destructive', onPress: () => removeFavoriteMeal(fav.id) },
                ]);
              }}
            >
              <Text style={styles.favoriteDeleteText}>🗑️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'photo' && styles.tabActive]}
          onPress={() => setActiveTab('photo')}
        >
          <Text style={[styles.tabText, activeTab === 'photo' && styles.tabTextActive]}>📸 Fotoğraf Analizi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && styles.tabActive]}
          onPress={() => setActiveTab('favorites')}
        >
          <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]}>
            ⭐ Favoriler {favoriteMeals.length > 0 ? `(${favoriteMeals.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {activeTab === 'favorites' ? renderFavorites() : (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>🤖 AI Yemek Analizi</Text>
              <Text style={styles.subtitle}>
                Fotoğraf çek, 3 saniyede kalori, karbonhidrat ve tüm besin değerlerini öğren.
              </Text>
            </View>

            {!image ? (
              <View style={styles.uploadSection}>
                <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage(true)}>
                  <Text style={styles.uploadIcon}>📸</Text>
                  <Text style={styles.uploadTitle}>Fotoğraf Çek</Text>
                  <Text style={styles.uploadSubtitle}>Kamerayı kullan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage(false)}>
                  <Text style={styles.uploadIcon}>🖼️</Text>
                  <Text style={styles.uploadTitle}>Galeriden Seç</Text>
                  <Text style={styles.uploadSubtitle}>Mevcut fotoğraf</Text>
                </TouchableOpacity>
                {!entitlement.isPro && (
                  <View style={styles.proNotice}>
                    <Text style={styles.proNoticeText}>🔒 Fotoğraf analizi PRO özelliğidir</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Paywall', { source: 'meal_screen' })}>
                      <Text style={styles.proNoticeLink}>PRO'ya Yükselt</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.resultSection}>
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
                    <Text style={styles.loadingSubtext}>Yemekler tanınıyor, besin değerleri hesaplanıyor</Text>
                  </View>
                ) : result ? (
                  <>
                    {/* Glycemic Impact Badge */}
                    {renderGlycemicBadge()}

                    {/* Macro Breakdown — Zinde-style grid */}
                    {renderMacroCard()}

                    {/* Editable Carbs */}
                    <View style={styles.editCarbsRow}>
                      <Text style={styles.editCarbsLabel}>KH Düzenle:</Text>
                      <TextInput
                        style={styles.editCarbsInput}
                        value={String(editedCarbs)}
                        onChangeText={(t) => setEditedCarbs(parseInt(t) || 0)}
                        keyboardType="numeric"
                      />
                      <Text style={styles.editCarbsUnit}>g</Text>
                    </View>

                    {/* Notes */}
                    {result.notes ? (
                      <View style={styles.notesCard}>
                        <Text style={styles.notesText}>💡 {result.notes}</Text>
                      </View>
                    ) : null}

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
                                {item.portion}
                                {item.glycemicIndex ? ` • ` : ''}
                                {item.glycemicIndex && (
                                  <Text style={{ color: getGIColor(item.glycemicIndex) }}>
                                    {getGIText(item.glycemicIndex)}
                                  </Text>
                                )}
                              </Text>
                              <Text style={styles.itemMacros}>
                                {item.calories ? `${item.calories} kcal` : ''}
                                {item.protein_g ? ` • ${item.protein_g}g P` : ''}
                                {item.fat_g ? ` • ${item.fat_g}g Y` : ''}
                              </Text>
                            </View>
                            <Text style={styles.itemCarbs}>{item.carbs_g}g</Text>
                          </View>
                        ))
                      )}
                    </View>

                    {/* Confidence */}
                    <Text style={styles.confidenceFooter}>
                      Güven seviyesi: {getConfidenceText(result.confidence)}
                    </Text>

                    {/* Actions */}
                    <View style={styles.actionsColumn}>
                      <TouchableOpacity style={styles.saveButton} onPress={() => saveMeal(false)}>
                        <Text style={styles.saveButtonText}>💾 Öğün Kaydet</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.favButton} onPress={() => saveMeal(true)}>
                        <Text style={styles.favButtonText}>⭐ Kaydet + Favorilere Ekle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.retryButton} onPress={resetScreen}>
                        <Text style={styles.retryButtonText}>🔄 Yeni Fotoğraf</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </View>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollView: { flex: 1 },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#16A34A' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#16A34A' },
  // Header
  header: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  // Upload
  uploadSection: { padding: 20 },
  uploadButton: {
    backgroundColor: '#FFFFFF', padding: 24, borderRadius: 20,
    alignItems: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  uploadIcon: { fontSize: 48, marginBottom: 12 },
  uploadTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  uploadSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  proNotice: {
    backgroundColor: '#FEF3C7', padding: 16, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8,
  },
  proNoticeText: { fontSize: 14, color: '#92400E' },
  proNoticeLink: { fontSize: 14, fontWeight: '600', color: '#16A34A' },
  // Result
  resultSection: { padding: 20 },
  imageContainer: { position: 'relative', borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  previewImage: { width: '100%', height: 250, resizeMode: 'cover' },
  removeButton: {
    position: 'absolute', top: 12, right: 12, width: 36, height: 36,
    borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  removeButtonText: { color: '#FFFFFF', fontSize: 18 },
  // Loading
  loadingContainer: { alignItems: 'center', padding: 40 },
  loadingText: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginTop: 16 },
  loadingSubtext: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  // Macro Grid
  macroContainer: { marginBottom: 16 },
  macroRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  macroBox: {
    flex: 1, padding: 16, borderRadius: 16, alignItems: 'center',
  },
  macroValue: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  macroLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 4 },
  macroIcon: { fontSize: 20, marginTop: 4 },
  fiberRow: {
    backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10, alignItems: 'center',
  },
  fiberText: { fontSize: 14, fontWeight: '600', color: '#16A34A' },
  // GI Badge
  giBadge: {
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16,
  },
  giBadgeText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  // Edit Carbs
  editCarbsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, marginBottom: 16,
  },
  editCarbsLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginRight: 8 },
  editCarbsInput: {
    fontSize: 20, fontWeight: '700', color: '#16A34A',
    backgroundColor: '#F0FDF4', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, minWidth: 60, textAlign: 'center',
  },
  editCarbsUnit: { fontSize: 16, color: '#6B7280', marginLeft: 4 },
  // Notes
  notesCard: { backgroundColor: '#E0F2FE', padding: 16, borderRadius: 12, marginBottom: 16 },
  notesText: { fontSize: 14, color: '#0369A1', lineHeight: 20 },
  // Items
  itemsCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 12 },
  itemsTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 16 },
  noItemsText: { fontSize: 14, color: '#6B7280', textAlign: 'center', padding: 20 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  itemPortion: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  itemMacros: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  itemCarbs: { fontSize: 16, fontWeight: '700', color: '#16A34A' },
  confidenceFooter: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  // Actions
  actionsColumn: { gap: 10 },
  saveButton: {
    backgroundColor: '#16A34A', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  favButton: {
    backgroundColor: '#FEF3C7', paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  favButtonText: { color: '#92400E', fontSize: 15, fontWeight: '600' },
  retryButton: {
    backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  retryButtonText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  // Favorites
  favoritesContainer: { padding: 20 },
  favoritesTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  favoritesSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  favoriteCard: {
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  favoriteInfo: { flex: 1 },
  favoriteName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  favoriteMacros: { fontSize: 13, color: '#16A34A', marginTop: 4 },
  favoriteUsage: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  favoriteDelete: { padding: 8 },
  favoriteDeleteText: { fontSize: 18 },
  // Empty
  emptyFavorites: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
});
