# DiaMate Production Runbook

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli eas-cli`
- Netlify CLI: `npm install -g netlify-cli`
- Apple Developer Account (for iOS)
- Google Play Developer Account (for Android)
- RevenueCat Account (for subscriptions)

---

## 📱 Mobile App Setup

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Configure Environment
Edit `app.json` and update:
- `extra.apiUrl`: Your Netlify URL (e.g., `https://diamate.org/.netlify/functions`)
- `extra.supabaseUrl`: Your Supabase URL
- `extra.supabaseAnonKey`: Your Supabase anon key
- `ios.bundleIdentifier`: `org.diamate.app`
- `android.package`: `org.diamate.app`

### 3. Configure RevenueCat
Edit `src/services/purchases.ts`:
- `REVENUECAT_IOS_KEY`: Your iOS API key
- `REVENUECAT_ANDROID_KEY`: Your Android API key

### 4. Build & Deploy
```bash
# Login to EAS
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## 🌐 Backend Setup (Netlify)

### 1. Deploy to Netlify
```bash
cd DiaMate-INVESTOR
netlify login
netlify init
netlify deploy --prod
```

### 2. Set Environment Variables
In Netlify Dashboard → Site Settings → Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Groq API key (preferred) | ✅ |
| `OPENAI_API_KEY` | OpenAI API key (for vision) | ✅ |
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | ✅ |

### 3. Get API Keys

**Groq (Recommended for chat):**
1. Go to [console.groq.com](https://console.groq.com)
2. Create account → API Keys → Create
3. Copy key (starts with `gsk_`)

**OpenAI (Required for vision):**
1. Go to [platform.openai.com](https://platform.openai.com)
2. API Keys → Create new secret key
3. Copy key (starts with `sk-`)

---

## 🗄️ Database Setup (Supabase)

### 1. Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy URL and anon key

### 2. Run Schema
Execute the SQL in `backend/supabase/schema.sql` and `backend/supabase/schema-health.sql`

---

## 💳 Subscription Setup (RevenueCat)

### 1. Create Products
**App Store Connect:**
- `diamate_pro_monthly` - Monthly subscription
- `diamate_pro_yearly` - Yearly subscription

**Google Play Console:**
- Same product IDs

### 2. Configure RevenueCat
1. Create app in RevenueCat
2. Add products
3. Create entitlement: `pro`
4. Get API keys for iOS and Android

---

## 🔗 Deep Links Setup

### iOS (Apple App Site Association)
1. Update `TEAM_ID` in `.well-known/apple-app-site-association`
2. Add Associated Domains in Xcode: `applinks:diamate.org`

### Android (Asset Links)
1. Get SHA256 fingerprint: `keytool -list -v -keystore your.keystore`
2. Update `.well-known/assetlinks.json`

---

## ✅ Test Checklist

### AI Chat
- [ ] Send message → Get real AI response
- [ ] Ask for insulin dose → Get safety response
- [ ] Check quota limit works

### Photo Analysis
- [ ] Take photo → Get carb analysis
- [ ] PRO required message for FREE users

### Health Integration
- [ ] iOS: HealthKit permission flow
- [ ] Android: Health Connect permission flow
- [ ] Glucose sync works

### Subscriptions
- [ ] Paywall displays correctly
- [ ] Purchase flow works
- [ ] Restore purchases works

---

## 🔒 Security Checklist

- [ ] API keys only in server environment
- [ ] User never enters API key
- [ ] AI never gives specific insulin doses
- [ ] Health data minimization
- [ ] HTTPS only
- [ ] JWT validation on protected endpoints

---

## 📊 Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│ Netlify Functions│────▶│   Groq/OpenAI   │
│  (React Native) │     │   (Backend)      │     │   (AI APIs)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  HealthKit /    │     │    Supabase     │
│ Health Connect  │     │  (Auth + DB)    │
└─────────────────┘     └─────────────────┘
```

---

## 🆘 Troubleshooting

### "AI service not configured"
- Check `GROQ_API_KEY` or `OPENAI_API_KEY` in Netlify env vars
- Redeploy after setting

### "Vision service not configured"
- Vision requires `OPENAI_API_KEY` (Groq doesn't support vision)

### Health data not syncing
- Check permissions in device settings
- Ensure CGM app writes to Health

### Subscription not working
- Check RevenueCat dashboard
- Verify product IDs match
- Test with sandbox account
