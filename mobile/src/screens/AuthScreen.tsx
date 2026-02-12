/**
 * DiaMate Auth Screen
 * Email/password login and signup
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signIn, signUp, getSupabase } from '../services/supabase';
import { useAppStore } from '../store/appStore';

type Mode = 'login' | 'signup' | 'forgot';

export function AuthScreen() {
  const { setUserId } = useAppStore();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Hata', 'E-posta ve şifre gerekli.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await signIn(email.trim(), password);
      if (user) {
        setUserId(user.id);
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('Invalid login')) {
        Alert.alert('Hata', 'E-posta veya şifre yanlış.');
      } else if (msg.includes('Email not confirmed')) {
        Alert.alert('Doğrulama Gerekli', 'Lütfen e-postanızı doğrulayın. Gelen kutunuzu kontrol edin.');
      } else {
        Alert.alert('Hata', msg || 'Giriş başarısız.');
      }
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Hata', 'E-posta ve şifre gerekli.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await signUp(email.trim(), password);
      if (user) {
        setUserId(user.id);
        Alert.alert('Başarılı', 'Hesabınız oluşturuldu. E-posta doğrulama linki gönderildi.');
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('already registered')) {
        Alert.alert('Hata', 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.');
      } else {
        Alert.alert('Hata', msg || 'Kayıt başarısız.');
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Hata', 'E-posta adresinizi girin.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      Alert.alert('Gönderildi', 'Şifre sıfırlama linki e-postanıza gönderildi.');
      setMode('login');
    } catch (error: any) {
      Alert.alert('Hata', error?.message || 'İşlem başarısız.');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🩺</Text>
            <Text style={styles.logoText}>DiaMate</Text>
            <Text style={styles.logoSubtext}>AI Diyabet Asistanı</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {mode === 'login' ? 'Giriş Yap' : mode === 'signup' ? 'Hesap Oluştur' : 'Şifremi Unuttum'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>E-posta</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {mode !== 'forgot' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Şifre</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                />
              </View>
            )}

            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Şifre Tekrar</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                />
              </View>
            )}

            {/* Primary Action */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleForgotPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === 'login' ? 'Giriş Yap' : mode === 'signup' ? 'Kayıt Ol' : 'Sıfırlama Linki Gönder'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Secondary Actions */}
            {mode === 'login' && (
              <>
                <TouchableOpacity style={styles.linkButton} onPress={() => setMode('forgot')}>
                  <Text style={styles.linkButtonText}>Şifremi Unuttum</Text>
                </TouchableOpacity>
                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>veya</Text>
                  <View style={styles.divider} />
                </View>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode('signup')}>
                  <Text style={styles.secondaryButtonText}>Yeni Hesap Oluştur</Text>
                </TouchableOpacity>
              </>
            )}

            {mode === 'signup' && (
              <TouchableOpacity style={styles.linkButton} onPress={() => setMode('login')}>
                <Text style={styles.linkButtonText}>Zaten hesabım var — Giriş Yap</Text>
              </TouchableOpacity>
            )}

            {mode === 'forgot' && (
              <TouchableOpacity style={styles.linkButton} onPress={() => setMode('login')}>
                <Text style={styles.linkButtonText}>← Giriş ekranına dön</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            Devam ederek Gizlilik Politikası ve Kullanım Koşullarını kabul etmiş olursunuz.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 64, marginBottom: 12 },
  logoText: { fontSize: 32, fontWeight: '800', color: '#0D3B2E' },
  logoSubtext: { fontSize: 15, color: '#6B7280', marginTop: 4 },
  formContainer: { marginBottom: 32 },
  formTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 24 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 14, fontSize: 16, color: '#1F2937',
  },
  primaryButton: {
    backgroundColor: '#16A34A', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 8,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  linkButton: { alignItems: 'center', paddingVertical: 14 },
  linkButtonText: { fontSize: 14, color: '#16A34A', fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  divider: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: '#9CA3AF' },
  secondaryButton: {
    borderWidth: 2, borderColor: '#16A34A', paddingVertical: 14,
    borderRadius: 14, alignItems: 'center',
  },
  secondaryButtonText: { color: '#16A34A', fontSize: 16, fontWeight: '600' },
  footer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },
});
