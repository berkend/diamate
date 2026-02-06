# DiaMate Pro - Deployment Runbook

## Quick Deploy to Netlify

### 1. Push to GitHub
```bash
cd DiaMate-INVESTOR
git init
git add .
git commit -m "DiaMate Pro - Production Ready"
git remote add origin https://github.com/YOUR_USERNAME/diamate-pro.git
git push -u origin main
```

### 2. Connect to Netlify
1. Go to [netlify.com](https://netlify.com) and sign in
2. Click "Add new site" → "Import an existing project"
3. Select your GitHub repo
4. Build settings (auto-detected from netlify.toml):
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
5. Click "Deploy site"

### 3. Set Environment Variables
In Netlify dashboard → Site settings → Environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key (sk-...) | ✅ Yes |
| `OPENAI_MODEL` | Model to use (default: gpt-4o-mini) | No |

**To get OpenAI API key:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up / Sign in
3. Go to API Keys → Create new secret key
4. Copy the key (starts with `sk-`)

### 4. Redeploy
After setting env vars, trigger a redeploy:
- Deploys → Trigger deploy → Deploy site

---

## Testing

### Test AI Chat
1. Open your Netlify URL (e.g., `https://your-site.netlify.app`)
2. Complete the setup wizard
3. Go to Chat tab (🤖)
4. Send a message like "Merhaba, bugün nasılım?"
5. Should get a real AI response (not an error)

### Test Photo Analysis
1. Go to Photo tab (📸)
2. Upload a food photo
3. Click "AI Analizi Başlat"
4. Should see detected foods with carb estimates

### Test Safety Filter
1. In chat, ask: "Kaç ünite insülin yapmalıyım?"
2. Should get a safety response redirecting to dose calculator
3. AI should NEVER give specific insulin doses

---

## Troubleshooting

### "AI service not configured" error
- Check that `OPENAI_API_KEY` is set in Netlify env vars
- Redeploy after setting the variable

### "AI service temporarily unavailable" error
- Check OpenAI API status: [status.openai.com](https://status.openai.com)
- Check your OpenAI account has credits
- Check API key is valid (not expired/revoked)

### Photo analysis fails
- Image must be under 1.5MB
- Supported formats: JPEG, PNG, WebP
- Make sure it's a clear food photo

### CORS errors
- Check netlify.toml has correct headers
- Clear browser cache and retry

---

## Local Development

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Link to your site
netlify link

# Set local env vars
netlify env:set OPENAI_API_KEY sk-your-key

# Run locally with functions
netlify dev
```

Opens at `http://localhost:8888`

---

## Architecture

```
Browser                    Netlify Functions           OpenAI
   │                             │                       │
   │  POST /ai-chat              │                       │
   │ ─────────────────────────►  │                       │
   │  {messages, lang}           │                       │
   │                             │  POST /v1/chat        │
   │                             │ ─────────────────────►│
   │                             │  {model, messages}    │
   │                             │                       │
   │                             │  ◄─────────────────── │
   │                             │  {choices}            │
   │  ◄───────────────────────── │                       │
   │  {text}                     │                       │
```

**Key Points:**
- User NEVER enters API key
- All AI calls go through Netlify Functions
- API key stored securely in Netlify env vars
- Safety filter prevents insulin dose instructions
- No service worker = no stale cache issues
