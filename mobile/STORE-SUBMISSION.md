# DiaMate — Store Submission Guide

## iOS Info.plist Açıklamaları (TR/EN)

### NSHealthShareUsageDescription
**EN:** DiaMate reads your health data (blood glucose, nutrition, activity, sleep) to personalize your diabetes management experience. Health data is never used for advertising, marketing, or data mining.
**TR:** DiaMate, diyabet yönetiminizi kişiselleştirmek için sağlık verilerinizi (kan şekeri, beslenme, aktivite, uyku) okur. Sağlık verileri reklam, pazarlama veya veri madenciliği için kullanılmaz.

### NSHealthUpdateUsageDescription
**EN:** DiaMate can write blood glucose and nutrition entries to Apple Health to keep your records in sync.
**TR:** DiaMate, kayıtlarınızı senkronize tutmak için Apple Health'e kan şekeri ve beslenme verileri yazabilir.

### NSCameraUsageDescription
**EN:** DiaMate uses your camera to photograph meals for AI-powered carbohydrate analysis.
**TR:** DiaMate, AI destekli karbonhidrat analizi için yemek fotoğrafı çekmek üzere kameranızı kullanır.

### NSPhotoLibraryUsageDescription
**EN:** DiaMate accesses your photos to analyze meal images for carbohydrate estimation.
**TR:** DiaMate, karbonhidrat tahmini için yemek fotoğraflarınıza erişir.

---

## App Store Review Notes

```
DiaMate is an AI-powered diabetes management companion app.

HEALTH DATA ACCESS:
- HealthKit integration is OPTIONAL. The app works fully without it.
- Health data is accessed ONLY with explicit user consent during onboarding.
- Users can skip health permissions and still use all core features (manual glucose entry, AI chat, meal photo analysis).
- If permission is denied, the app shows a friendly message and continues normally.

DATA USAGE:
- Health data is used ONLY for diabetes management (glucose tracking, trend analysis, personalized AI coaching).
- NO health data is used for advertising, marketing, or data mining.
- NO health data is shared with third parties.
- NO user tracking (ATT not implemented — not needed).

MEDICAL DISCLAIMER:
- DiaMate is NOT a medical device.
- It does NOT diagnose conditions or prescribe treatments.
- All AI responses include disclaimers to consult healthcare providers.
- The app is a wellness/lifestyle tool for diabetes self-management.

SUBSCRIPTION:
- Free tier: 5 AI chat messages/day, manual glucose entry, insights.
- PRO tier: Unlimited AI chat, photo meal analysis, advanced reports.
- Subscriptions managed via Apple IAP (auto-renewable).

TEST ACCOUNT:
- Email: reviewer@diamate.org / Password: DiaMateReview2025!
- Or skip login and use onboarding flow to test.
```

---

## Google Play Store Açıklama Disclaimer (TR/EN)

### Kısa Açıklama (TR)
DiaMate — Yapay zeka destekli diyabet yönetim asistanınız. Glukoz takibi, yemek analizi ve kişisel öneriler.

### Kısa Açıklama (EN)
DiaMate — Your AI-powered diabetes management assistant. Glucose tracking, meal analysis, and personalized insights.

### Uzun Açıklama Disclaimer (TR — açıklamanın sonuna eklenecek)
```
⚠️ ÖNEMLİ UYARI:
DiaMate tıbbi bir cihaz değildir. Hastalık teşhisi koymaz, tedavi önermez veya reçete yazmaz. Bu uygulama yalnızca diyabet öz-yönetimini desteklemek amacıyla genel bilgi ve yapay zeka destekli öneriler sunar. Tedavi kararlarınız için her zaman doktorunuza veya sağlık uzmanınıza danışın.

Sağlık verileri (kan şekeri, beslenme, aktivite, uyku) yalnızca kullanıcının açık izniyle okunur ve yalnızca diyabet yönetimi amacıyla kullanılır. Veriler reklam, pazarlama veya veri madenciliği için kullanılmaz. Üçüncü taraflarla paylaşılmaz.
```

### Uzun Açıklama Disclaimer (EN — açıklamanın sonuna eklenecek)
```
⚠️ IMPORTANT DISCLAIMER:
DiaMate is not a medical device. It does not diagnose diseases, recommend treatments, or prescribe medication. This app provides general information and AI-powered suggestions solely to support diabetes self-management. Always consult your doctor or healthcare provider for treatment decisions.

Health data (blood glucose, nutrition, activity, sleep) is read only with explicit user consent and used solely for diabetes management purposes. Data is never used for advertising, marketing, or data mining. It is not shared with third parties.
```

---

## Google Play Data Safety Checklist

DiaMate'in gerçek veri kullanımına göre işaretlenecek kategoriler:

### Toplanan Veriler (Data Collected)

| Kategori | Veri Tipi | Toplanan? | Paylaşılan? | Amaç |
|----------|-----------|-----------|-------------|------|
| Health & fitness | Blood glucose readings | ✅ Evet | ❌ Hayır | App functionality |
| Health & fitness | Nutrition / meals | ✅ Evet | ❌ Hayır | App functionality |
| Health & fitness | Steps / activity | ✅ Evet (opsiyonel) | ❌ Hayır | App functionality |
| Health & fitness | Sleep | ✅ Evet (opsiyonel) | ❌ Hayır | App functionality |
| Personal info | Name | ✅ Evet | ❌ Hayır | App functionality, personalization |
| Personal info | Email | ✅ Evet | ❌ Hayır | Account management |
| Photos | Meal photos | ✅ Evet | ❌ Hayır | App functionality (AI analysis) |
| App activity | In-app search/actions | ✅ Evet | ❌ Hayır | Analytics, app functionality |
| Financial info | Purchase history | ✅ Evet | ❌ Hayır | Subscription management |

### İşaretlenMEyecek Kategoriler
- ❌ Location — toplanmıyor
- ❌ Contacts — toplanmıyor
- ❌ Messages — toplanmıyor
- ❌ Audio — toplanmıyor
- ❌ Files — toplanmıyor
- ❌ Calendar — toplanmıyor
- ❌ Device identifiers — reklam ID'si toplanmıyor

### Güvenlik Soruları
- ✅ Data encrypted in transit (HTTPS)
- ✅ Users can request data deletion (Settings > Hesabımı Sil)
- ❌ Data NOT shared with third parties
- ❌ Data NOT used for advertising
- ❌ Data NOT used for tracking

### Health Apps Declaration (Google Play)
- App category: Health & Fitness
- Health claims: NONE (not a medical device)
- Government approval: NOT REQUIRED (wellness app, not medical device)
- Disclaimer: Included in store listing and in-app

---

## Health İzin Reddi UX Akışı

```
Onboarding Step 4: Health Permissions
├── "İzin Ver" tıklandı
│   ├── İzin verildi → Veri senkronize → "Bağlantı Başarılı" alert → Complete
│   ├── İzin reddedildi → "İzin Verilmedi" alert (graceful) → Complete
│   └── Hata oluştu → "Bağlantı Kurulamadı" alert → Complete
└── "Şimdilik Atla" tıklandı → Complete (no health prompt)

Ana Uygulama (Health bağlı değilken):
├── HomeScreen: "Glukoz Verisi Yok" kartı + "Sağlık Bağla" butonu + Manuel ölçüm ekleme
├── MealScreen: Normal çalışır (fotoğraf analizi health'e bağlı değil)
├── ChatScreen: Normal çalışır (AI sohbet health'e bağlı değil)
├── InsightsScreen: "Bugün Ölçüm Yok" + genel ipuçları gösterir
├── Settings > Sağlık Bağlantıları: "Bağlı Değil" + "Bağlan" butonu
└── Hiçbir ekran crash yapmaz, hiçbir özellik kilitlenmez
```

---

## EAS Build Komutları

```powershell
# Temiz kurulum
cd C:\Users\PC\Desktop\DiaMate-INVESTOR\mobile
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install --legacy-peer-deps

# Expo doctor
npx expo-doctor

# Android Production (AAB — Play Store)
eas build --platform android --profile production

# Android Preview (APK — test)
eas build --platform android --profile preview

# iOS Production (Apple Developer aktif olunca)
eas build --platform ios --profile production

# Submit
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

---

## Smoke Test Checklist

- [ ] App açılıyor, splash screen koyu yeşil arka planlı
- [ ] Onboarding: profil → diyabet → health (atla) → tamamla — crash yok
- [ ] Onboarding: health izin ver → reddet → graceful mesaj → devam
- [ ] Ana sayfa: health bağlı değilken "Glukoz Verisi Yok" kartı
- [ ] Manuel glukoz ekleme çalışıyor
- [ ] Meal: kamera/galeri açılıyor, fotoğraf analizi çalışıyor
- [ ] Chat: mesaj gönderme, AI yanıt, quota kontrolü
- [ ] Chat: FREE 5 mesaj sonra Paywall'a yönlendirme
- [ ] Paywall: paketler yükleniyor, satın alma akışı
- [ ] Insights: öneriler oluşturuyor (health verisi olmadan da)
- [ ] Settings: profil, abonelik, AI kişiselleştirme, gizlilik linkleri
- [ ] Settings > Sağlık Bağlantıları: bağlantı durumu, bağlan/kes
- [ ] Tab navigation: 5 tab arası sorunsuz geçiş
- [ ] Store rehydrate: app kapatıp açınca veriler korunuyor
- [ ] Offline: internet yokken crash yok, hata mesajı gösteriliyor
- [ ] ErrorBoundary: beklenmedik hata → "Tekrar Dene" ekranı
- [ ] Privacy/Terms linkleri açılıyor
- [ ] Disclaimer metni Health Connections ekranında görünüyor
