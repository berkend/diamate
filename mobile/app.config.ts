import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'DiaMate',
  slug: 'diamate',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0D3B2E',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'org.diamate.app',
    buildNumber: '2',
    infoPlist: {
      // Health permissions — TR (primary) with EN fallback context
      NSHealthShareUsageDescription:
        'DiaMate reads your health data (blood glucose, nutrition, activity, sleep) to personalize your diabetes management experience. ' +
        'DiaMate, diyabet yönetiminizi kişiselleştirmek için sağlık verilerinizi (kan şekeri, beslenme, aktivite, uyku) okur. ' +
        'Health data is never used for advertising, marketing, or data mining.',
      NSHealthUpdateUsageDescription:
        'DiaMate can write blood glucose and nutrition entries to Apple Health to keep your records in sync. ' +
        'DiaMate, kayıtlarınızı senkronize tutmak için Apple Health\'e kan şekeri ve beslenme verileri yazabilir.',
      // Camera & Photo
      NSCameraUsageDescription:
        'DiaMate uses your camera to photograph meals for AI-powered carbohydrate analysis. ' +
        'DiaMate, AI destekli karbonhidrat analizi için yemek fotoğrafı çekmek üzere kameranızı kullanır.',
      NSPhotoLibraryUsageDescription:
        'DiaMate accesses your photos to analyze meal images for carbohydrate estimation. ' +
        'DiaMate, karbonhidrat tahmini için yemek fotoğraflarınıza erişir.',
      // Encryption
      ITSAppUsesNonExemptEncryption: false,
      // User tracking — we do NOT track
      NSUserTrackingUsageDescription: undefined,
    },
    entitlements: {
      'com.apple.developer.healthkit': true,
      'com.apple.developer.healthkit.background-delivery': true,
    },
    associatedDomains: ['applinks:diamate.org', 'webcredentials:diamate.org'],
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0D3B2E',
    },
    package: 'org.diamate.app',
    versionCode: 5,
    permissions: [
      'android.permission.CAMERA',
      // Health Connect permissions — minimum required
      'android.permission.health.READ_BLOOD_GLUCOSE',
      'android.permission.health.WRITE_BLOOD_GLUCOSE',
      'android.permission.health.READ_NUTRITION',
      'android.permission.health.WRITE_NUTRITION',
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_SLEEP',
    ],
  },
  plugins: [
    'expo-secure-store',
    './plugins/withAndroidIapFlavor',
    [
      'expo-build-properties',
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
        ios: {
          deploymentTarget: '16.0',
        },
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'DiaMate uses your camera to photograph meals for AI carbohydrate analysis. ' +
          'DiaMate, AI karbonhidrat analizi için kameranızı kullanır.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'DiaMate accesses your photos to analyze meal images. ' +
          'DiaMate, yemek fotoğraflarını analiz etmek için fotoğraflarınıza erişir.',
      },
    ],
    [
      'react-native-health',
      {
        isClinicalDataEnabled: false,
      },
    ],
  ],
  extra: {
    apiUrl:
      process.env.API_URL || 'https://diamate.org/.netlify/functions',
    supabaseUrl:
      process.env.SUPABASE_URL || 'https://rvqmbawssxhzqldkdpjo.supabase.co',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    eas: {
      projectId: '42a5b3b7-6185-4cec-a94b-44b7f30d1368',
    },
  },
  newArchEnabled: false,
  scheme: 'diamate',
  owner: 'berken1dogan',
});
