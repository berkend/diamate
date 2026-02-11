/**
 * DiaMate Onboarding Screen
 * Collects user profile and requests health permissions
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../store/appStore';
import { HealthManager } from '../services/health/HealthManager';
import { UserProfile } from '../types';

type Step = 'welcome' | 'profile' | 'diabetes' | 'health' | 'complete';

export function OnboardingScreen() {
  const { setProfile, setOnboarded } = useAppStore();
  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(false);
  
  // Profile state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  
  // Diabetes state
  const [diabetesType, setDiabetesType] = useState<'T1' | 'T2' | 'GDM' | 'Other'>('T2');
  const [targetLow, setTargetLow] = useState('70');
  const [targetHigh, setTargetHigh] = useState('180');

  const handleProfileNext = () => {
    if (!name.trim() || !age || !height || !weight) {
      Alert.alert('Eksik Bilgi', 'Lütfen tüm alanları doldurun.');
      return;
    }
    setStep('diabetes');
  };

  const handleDiabetesNext = () => {
    setStep('health');
  };

  const handleHealthPermissions = async () => {
    setLoading(true);
    try {
      const granted = await HealthManager.requestPermissions();
      if (granted) {
        await HealthManager.syncGlucoseReadings(30);
        Alert.alert(
          'Bağlantı Başarılı',
          'Sağlık verileriniz senkronize edildi.',
          [{ text: 'Devam', onPress: () => setStep('complete') }]
        );
      } else {
        // Permission denied — graceful fallback, app continues
        Alert.alert(
          'İzin Verilmedi',
          'Sağlık verisi erişimi olmadan da DiaMate\'i kullanabilirsiniz. Manuel glukoz girişi, AI sohbet ve yemek analizi çalışmaya devam eder.\n\nDaha sonra Ayarlar > Sağlık Bağlantıları\'ndan bağlayabilirsiniz.',
          [{ text: 'Anladım', onPress: () => setStep('complete') }]
        );
      }
    } catch (error) {
      // Error — still continue, health is optional
      Alert.alert(
        'Bağlantı Kurulamadı',
        'Sağlık bağlantısı şu an kurulamadı. Endişelenmeyin, uygulamayı sağlık verisi olmadan da kullanabilirsiniz.',
        [{ text: 'Devam', onPress: () => setStep('complete') }]
      );
    }
    setLoading(false);
  };

  const handleSkipHealth = () => {
    setStep('complete');
  };

  const handleComplete = () => {
    const profile: Partial<UserProfile> = {
      name: name.trim(),
      age: parseInt(age),
      gender,
      height: parseInt(height),
      weight: parseInt(weight),
      diabetesType,
      targetLow: parseInt(targetLow),
      targetHigh: parseInt(targetHigh),
      language: 'tr',
      activityLevel: 'moderate',
    };
    
    setProfile(profile);
    setOnboarded(true);
  };

  const renderWelcome = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.emoji}>🩺</Text>
      <Text style={styles.title}>DiaMate'e Hoş Geldiniz</Text>
      <Text style={styles.subtitle}>
        Yapay zeka destekli diyabet asistanınız. Glukoz takibi, yemek analizi ve kişiselleştirilmiş öneriler.
      </Text>
      
      <View style={styles.features}>
        <FeatureItem icon="📊" text="Glukoz Takibi" />
        <FeatureItem icon="📸" text="AI Yemek Analizi" />
        <FeatureItem icon="🤖" text="AI Koçluk" />
        <FeatureItem icon="💡" text="Kişisel Öneriler" />
      </View>
      
      <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('profile')}>
        <Text style={styles.primaryButtonText}>Başla</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Profil Bilgileri</Text>
      <Text style={styles.stepSubtitle}>Size daha iyi yardımcı olabilmemiz için</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>İsim</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Adınız"
          placeholderTextColor="#9CA3AF"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Yaş</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder="25"
          keyboardType="numeric"
          placeholderTextColor="#9CA3AF"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Cinsiyet</Text>
        <View style={styles.segmentedControl}>
          {(['male', 'female', 'other'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.segment, gender === g && styles.segmentActive]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.segmentText, gender === g && styles.segmentTextActive]}>
                {g === 'male' ? 'Erkek' : g === 'female' ? 'Kadın' : 'Diğer'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Boy (cm)</Text>
          <TextInput
            style={styles.input}
            value={height}
            onChangeText={setHeight}
            placeholder="170"
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Kilo (kg)</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="70"
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleProfileNext}>
        <Text style={styles.primaryButtonText}>Devam</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderDiabetes = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Diyabet Bilgileri</Text>
      <Text style={styles.stepSubtitle}>Kişiselleştirilmiş öneriler için</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Diyabet Tipi</Text>
        <View style={styles.optionGrid}>
          {([
            { value: 'T1', label: 'Tip 1' },
            { value: 'T2', label: 'Tip 2' },
            { value: 'GDM', label: 'Gebelik' },
            { value: 'Other', label: 'Diğer' },
          ] as const).map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionCard, diabetesType === option.value && styles.optionCardActive]}
              onPress={() => setDiabetesType(option.value)}
            >
              <Text style={[styles.optionText, diabetesType === option.value && styles.optionTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Hedef Glukoz Aralığı (mg/dL)</Text>
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.sublabel}>Alt</Text>
            <TextInput
              style={styles.input}
              value={targetLow}
              onChangeText={setTargetLow}
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.sublabel}>Üst</Text>
            <TextInput
              style={styles.input}
              value={targetHigh}
              onChangeText={setTargetHigh}
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>
      </View>
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleDiabetesNext}>
        <Text style={styles.primaryButtonText}>Devam</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderHealth = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.emoji}>{Platform.OS === 'ios' ? '🍎' : '💚'}</Text>
      <Text style={styles.stepTitle}>
        {Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}
      </Text>
      <Text style={styles.stepSubtitle}>
        Glukoz verilerinizi otomatik olarak senkronize edin. CGM cihazınız (Dexcom, Libre vb.) 
        {Platform.OS === 'ios' ? " Apple Health'e" : " Health Connect'e"} veri yazıyorsa, 
        DiaMate bu verileri otomatik olarak görebilir.
      </Text>

      <View style={styles.optionalBadge}>
        <Text style={styles.optionalBadgeText}>
          ℹ️ Bu adım isteğe bağlıdır. Sağlık verisi olmadan da DiaMate'i kullanabilirsiniz.
        </Text>
      </View>
      
      <View style={styles.permissionList}>
        <PermissionItem icon="📊" text="Kan şekeri ölçümleri" />
        <PermissionItem icon="🍽️" text="Beslenme verileri" />
        <PermissionItem icon="🚶" text="Aktivite verileri" />
        <PermissionItem icon="😴" text="Uyku verileri" />
      </View>

      <View style={styles.privacyNotice}>
        <Text style={styles.privacyNoticeText}>
          🔒 Sağlık verileriniz yalnızca diyabet yönetimi için kullanılır. Reklam, pazarlama veya veri madenciliği amacıyla kullanılmaz.
        </Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.primaryButton, loading && styles.buttonDisabled]} 
        onPress={handleHealthPermissions}
        disabled={loading}
      >
        <Text style={styles.primaryButtonText}>
          {loading ? 'Bağlanıyor...' : 'İzin Ver'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.secondaryButton} onPress={handleSkipHealth}>
        <Text style={styles.secondaryButtonText}>Şimdilik Atla</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderComplete = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Hazırsınız!</Text>
      <Text style={styles.subtitle}>
        DiaMate artık size yardımcı olmaya hazır. Glukoz takibi yapın, yemek fotoğrafı çekin 
        ve AI koçunuzla sohbet edin.
      </Text>
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleComplete}>
        <Text style={styles.primaryButtonText}>Başla</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {step === 'welcome' && renderWelcome()}
      {step === 'profile' && renderProfile()}
      {step === 'diabetes' && renderDiabetes()}
      {step === 'health' && renderHealth()}
      {step === 'complete' && renderComplete()}
    </SafeAreaView>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function PermissionItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.permissionItem}>
      <Text style={styles.permissionIcon}>{icon}</Text>
      <Text style={styles.permissionText}>{text}</Text>
      <Text style={styles.permissionCheck}>✓</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stepContainer: {
    flex: 1,
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
  },
  features: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 8,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  row: {
    flexDirection: 'row',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#16A34A',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionCard: {
    width: '48%',
    margin: '1%',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
  },
  optionCardActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  optionTextActive: {
    color: '#16A34A',
  },
  permissionList: {
    marginBottom: 16,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  permissionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  permissionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  permissionCheck: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  optionalBadge: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  optionalBadgeText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  privacyNotice: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  privacyNoticeText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
});
