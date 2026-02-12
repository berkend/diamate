# DiaMate — Cloudflare Pages + Supabase Edge Functions Deploy Rehberi

## Mimari
- **Static Site** → Cloudflare Pages (sınırsız bandwidth, ücretsiz)
- **API Functions** → Supabase Edge Functions (500K invocation/ay ücretsiz)
- **Database + Auth** → Supabase (zaten mevcut)

---

## ADIM 1: Supabase Edge Functions Deploy

### 1a. Supabase CLI Kur
```bash
npm install -g supabase
```

### 1b. Supabase'e Login
```bash
supabase login
```
Tarayıcıda açılan sayfadan token al.

### 1c. Projeyi Bağla
```bash
cd C:\Users\PC\Desktop\DiaMate-INVESTOR
supabase link --project-ref rvqmbawssxhzqldkdpjo
```

### 1d. Secrets (Environment Variables) Ekle
```bash
supabase secrets set GROQ_API_KEY=<senin-groq-key>
supabase secrets set OPENAI_API_KEY=<senin-openai-key>
supabase secrets set SUPABASE_URL=https://rvqmbawssxhzqldkdpjo.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<senin-service-role-key>
```

### 1e. Functions Deploy
```bash
supabase functions deploy ai-chat
supabase functions deploy ai-vision
supabase functions deploy entitlement
```

### 1f. Test Et
```bash
curl https://rvqmbawssxhzqldkdpjo.supabase.co/functions/v1/entitlement
```
`{"isPro":false,"plan":"FREE",...}` dönmeli.

---

## ADIM 2: Cloudflare Pages Deploy

### 2a. Cloudflare Hesabı Aç
https://dash.cloudflare.com/sign-up adresinden ücretsiz hesap aç.

### 2b. GitHub Repo Bağla
1. Cloudflare Dashboard → Pages → "Create a project"
2. "Connect to Git" → GitHub hesabını bağla
3. `berkend/diamate` reposunu seç
4. Build settings:
   - **Build command**: (boş bırak — static site)
   - **Build output directory**: `.` (root)
   - **Root directory**: `/` (root)
5. "Save and Deploy"

### 2c. Custom Domain Ekle
1. Pages projesine git → "Custom domains"
2. `diamate.org` ekle
3. Cloudflare DNS'e otomatik CNAME eklenecek

### 2d. DNS Ayarları (diamate.org)
Eğer domain Cloudflare'de değilse:
- Domain registrar'ında nameserver'ları Cloudflare'e yönlendir
- VEYA CNAME kaydı ekle: `diamate.org` → `diamate.pages.dev`

---

## ADIM 3: Doğrulama

1. https://diamate.org açılmalı (static site)
2. Login yapıp AI Chat test et (Supabase Edge Function)
3. Fotoğraf analizi test et (Vision Edge Function)

---

## Dosya Yapısı
```
supabase/functions/
├── _shared/
│   └── cors.ts          # Shared CORS headers
├── ai-chat/
│   └── index.ts         # AI Chat endpoint
├── ai-vision/
│   └── index.ts         # Food photo analysis
└── entitlement/
    └── index.ts         # User plan & quotas
```

## Notlar
- Cloudflare Pages: Sınırsız bandwidth, 500 build/ay
- Supabase Edge Functions: 500K invocation/ay ücretsiz
- Eski Netlify Functions hala repo'da duruyor (backup olarak)
- Mobile app API URL'si zaten güncellendi (app.config.ts)
