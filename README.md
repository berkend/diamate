# DiaMate Pro - AI-Powered Diabetes Management

Production-ready diabetes management platform with AI assistant, photo analysis, health integrations, and subscription system.

## Architecture

```
DiaMate-INVESTOR/
├── index.html                    # Web app entry (ES modules)
├── DiaMate-Standalone.html       # Single-file version (no server)
├── js/                           # Frontend modules
│   ├── app.js                    # Main app
│   ├── store.js                  # State management
│   ├── router.js                 # SPA routing
│   ├── safety.js                 # Client-side safety
│   ├── utils.js                  # Utilities
│   ├── api-client.js             # Backend API client
│   └── views/                    # View components
├── backend/
│   ├── package.json              # Dependencies
│   ├── netlify.toml              # Netlify config
│   ├── .env.example              # Environment template
│   ├── supabase/
│   │   ├── schema.sql            # Core database schema
│   │   └── schema-health.sql     # Health integrations schema
│   └── netlify/functions/
│       ├── lib/                  # Shared utilities
│       │   ├── supabase.js       # DB client
│       │   ├── auth.js           # JWT verification
│       │   ├── quotas.js         # Rate limiting
│       │   ├── ai-safety.js      # Safety filters
│       │   └── cgm-connectors.js # CGM connector implementations
│       ├── entitlement.js        # Subscription status
│       ├── ai-chat.js            # AI chat (with health context)
│       ├── ai-vision.js          # Photo analysis
│       ├── ai-insight.js         # Event-driven insights
│       ├── ai-memory-update.js   # Profile/memory management
│       ├── iap-apple-verify.js   # iOS purchase verification
│       ├── iap-google-verify.js  # Android purchase verification
│       ├── weekly-summary-cron.js # Weekly summary scheduler
│       ├── cgm-connect.js        # CGM OAuth & sync
│       ├── health-sync.js        # HealthKit/Health Connect sync
│       └── health-summary.js     # Health data summary for AI
└── mobile/
    └── src/
        ├── services/health/      # Health platform integrations
        │   ├── types.ts          # Type definitions
        │   ├── HealthKitService.ts    # iOS HealthKit
        │   ├── HealthConnectService.ts # Android Health Connect
        │   └── HealthManager.ts  # Unified health manager
        └── screens/
            └── HealthConnectionsScreen.tsx # Health settings UI
```

## Features

### FREE Tier
- 5 AI chat messages/day
- Glucose logging
- Dose calculator
- Basic reports

### PRO Tier ($4.99/month)
- 500 AI chat messages/month
- 200 photo analyses/month
- 150 event-driven insights/month
- 4 weekly summaries/month
- AI personalization with health data
- CGM integration (Dexcom)
- Advanced reports

## Health Integrations

### iOS - HealthKit
- Read blood glucose, nutrition, sleep, activity
- Write DiaMate logs to Apple Health
- Background sync support

### Android - Health Connect
- Read blood glucose, nutrition, sleep, activity
- Write DiaMate logs to Health Connect
- Explicit permission management

### CGM Connectors
- **Dexcom** (OAuth 2.0): Real-time glucose data
- More coming: Libre, Medtronic

### Data Normalization
All glucose data normalized to:
```json
{
  "source": "dexcom|apple_health|health_connect|manual",
  "timestamp": "ISO 8601",
  "mgdl": 120,
  "trend": "stable|rising|falling",
  "device": "Dexcom G6",
  "context": "fasting|before_meal|after_meal"
}
```

### Privacy Controls
- Toggle: "Read from Health Platform"
- Toggle: "Write DiaMate logs"
- Toggle: "Send health data to AI"
- Delete imported data anytime
- Disconnect CGM anytime

## Setup

### 1. Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Run `backend/supabase/schema.sql` in SQL Editor
3. Copy URL and keys to environment

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in your keys
netlify dev
```

### 3. Environment Variables
Set in Netlify dashboard or `.env`:
- `OPENAI_API_KEY` - OpenAI API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `SUPABASE_JWT_SECRET` - JWT secret
- `APPLE_*` - iOS IAP credentials
- `GOOGLE_*` - Android IAP credentials

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/entitlement` | GET | Yes | Get subscription status |
| `/api/ai-chat` | POST | Yes | AI chat (with health context) |
| `/api/ai-vision` | POST | Yes | Photo analysis (PRO) |
| `/api/ai-insight` | POST | Yes | Event insights (PRO) |
| `/api/ai-memory-update` | POST | Yes | Update profile/memory |
| `/api/iap-apple-verify` | POST | Yes | Verify iOS purchase |
| `/api/iap-google-verify` | POST | Yes | Verify Android purchase |
| `/api/weekly-summary-cron` | POST | Cron | Generate weekly summaries |
| `/api/cgm-connect` | GET/POST | Yes | CGM OAuth & sync |
| `/api/health-sync` | POST | Yes | HealthKit/Health Connect sync |
| `/api/health-summary` | GET | Yes | Health data summary |

## Safety

- AI never provides specific insulin doses
- Dose requests redirect to calculator
- All responses filtered for safety
- Rate limiting: 10 req/min per user

## Privacy (KVKK/GDPR)

- AI personalization toggle
- Memory clear option
- Full data deletion
- No raw health data in logs

## Mobile App (React Native Expo)

Coming soon - will include:
- Supabase Auth integration
- StoreKit 2 (iOS) / Play Billing (Android)
- Paywall UI
- Push notifications
