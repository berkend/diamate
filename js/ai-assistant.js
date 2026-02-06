/**
 * DiaMate AI Assistant - Production Server-Side Integration
 * Supports both server-side (Netlify) and client-side (fallback) modes
 */
import { getProfile, listEntries, getTodayEntries, getLatestEntry } from './store.js';
import { mean, stdDev, daysAgo, t, getLang } from './utils.js';
import { getGlucoseStatus } from './safety.js';

// API Base URL - uses relative path for Netlify Functions
const API_BASE = '/.netlify/functions';

// AI Memory storage key (local conversation history)
const AI_MEMORY_KEY = 'diamate_ai_memory';

// Client-side API key storage (fallback mode)
const API_KEY_STORAGE = 'diamate_ai_api_key';

// Check if we're in local dev mode (no Netlify Functions)
let useClientSide = false;

// ==========================================
// ENTITLEMENT & STATUS
// ==========================================

let cachedEntitlement = null;

/**
 * Get user entitlement (PRO status, quotas)
 */
export async function getEntitlement(forceRefresh = false) {
    if (cachedEntitlement && !forceRefresh) {
        return cachedEntitlement;
    }

    try {
        const response = await fetch(`${API_BASE}/entitlement`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        cachedEntitlement = await response.json();
        return cachedEntitlement;
    } catch (error) {
        console.warn('Entitlement check failed:', error);
        // Return default FREE entitlement
        return {
            isPro: false,
            plan: 'FREE',
            quotas: { chatPerDay: 5 },
            usage: { dailyChatCount: 0 }
        };
    }
}

/**
 * Check if AI is ready (always true for server-side)
 */
export function hasApiKey() {
    return true; // Server handles API keys
}

// ==========================================
// AI CHAT
// ==========================================

/**
 * Generate chat response via server (or client-side fallback)
 */
export async function generateChatResponse(userMessage) {
    const lang = getLang();
    const memory = getAIMemory();
    
    // Build conversation history
    const recentHistory = memory.conversations.slice(-5).flatMap(conv => [
        { role: 'user', content: conv.user },
        { role: 'assistant', content: conv.bot }
    ]);
    
    const messages = [
        ...recentHistory,
        { role: 'user', content: userMessage }
    ];
    
    // Build recent context for personalization
    const recentContext = buildRecentContext();
    
    // Try server-side first
    if (!useClientSide) {
        try {
            const response = await fetch(`${API_BASE}/ai-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, lang, recentContext })
            });
            
            // If 404, switch to demo mode (no Netlify Functions)
            if (response.status === 404) {
                console.log('Netlify Functions not available, switching to demo mode');
                useClientSide = true;
                return generateClientSideResponse(userMessage, messages, lang);
            }
            
            // Try to parse JSON
            let data;
            try {
                data = await response.json();
            } catch {
                // Non-JSON response (likely HTML error page)
                console.log('Non-JSON response, switching to demo mode');
                useClientSide = true;
                return generateClientSideResponse(userMessage, messages, lang);
            }
            
            if (!response.ok) {
                // Server returned an error - show it
                return handleAPIError(response.status, data, lang);
            }
            
            // Handle safety response
            let responseText = data.text;
            if (data.showCalculatorButton) {
                responseText += lang === 'en' 
                    ? '\n\n📱 [Open Dose Calculator](#dose)' 
                    : '\n\n📱 [Doz Hesaplayıcıyı Aç](#dose)';
            }
            
            return responseText;
            
        } catch (error) {
            // Network error or fetch failed - switch to demo mode
            console.warn('Server request failed:', error.message);
            useClientSide = true;
            return generateClientSideResponse(userMessage, messages, lang);
        }
    }
    
    // Client-side fallback
    return generateClientSideResponse(userMessage, messages, lang);
}

/**
 * Client-side AI response (fallback when no server)
 */
async function generateClientSideResponse(userMessage, messages, lang) {
    const apiKey = localStorage.getItem(API_KEY_STORAGE);
    
    if (!apiKey) {
        return lang === 'en'
            ? '🚀 **Demo Mode**\n\nAI features require deployment to Netlify.\n\n**For Investors:** This demo shows the UI/UX. Full AI functionality is available in the deployed production version.\n\n**For Developers:** Deploy to Netlify with `OPENAI_API_KEY` environment variable to enable AI.'
            : '🚀 **Demo Modu**\n\nAI özellikleri Netlify\'a deployment gerektirir.\n\n**Yatırımcılar için:** Bu demo UI/UX\'i gösterir. Tam AI işlevselliği deploy edilmiş production versiyonunda mevcuttur.\n\n**Geliştiriciler için:** AI\'ı etkinleştirmek için `OPENAI_API_KEY` environment variable ile Netlify\'a deploy edin.';
    }
    
    // Detect provider from key
    let baseUrl, model;
    if (apiKey.startsWith('gsk_')) {
        baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
        model = 'llama-3.1-8b-instant';
    } else if (apiKey.startsWith('sk-or-')) {
        baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
        model = 'meta-llama/llama-3.1-8b-instruct:free';
    } else {
        baseUrl = 'https://api.openai.com/v1/chat/completions';
        model = 'gpt-4o-mini';
    }
    
    const systemPrompt = buildClientSystemPrompt(lang);
    const aiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];
    
    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: aiMessages,
                max_tokens: 1024,
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                return lang === 'en' ? '❌ Invalid API key' : '❌ Geçersiz API anahtarı';
            }
            return `❌ Error: ${data.error?.message || response.status}`;
        }
        
        return data.choices[0].message.content;
    } catch (error) {
        return lang === 'en'
            ? `❌ Connection error: ${error.message}`
            : `❌ Bağlantı hatası: ${error.message}`;
    }
}

function buildClientSystemPrompt(lang) {
    const profile = getProfile();
    const todayGlucose = getTodayEntries('glucose');
    const latestGlucose = getLatestEntry('glucose');
    
    let context = '';
    if (latestGlucose) {
        context += `\nLatest glucose: ${latestGlucose.value} mg/dL`;
    }
    if (todayGlucose.length > 0) {
        const avg = Math.round(mean(todayGlucose.map(g => g.value)));
        context += `\nToday's average: ${avg} mg/dL (${todayGlucose.length} readings)`;
    }
    
    // Add insulin settings (icr = insulin-to-carb ratio, isf = insulin sensitivity factor)
    if (profile.icr) context += `\nCarb Ratio (ICR): 1:${profile.icr} (1 unit per ${profile.icr}g carbs)`;
    if (profile.isf) context += `\nCorrection Factor (ISF): 1:${profile.isf} (1 unit drops BG by ${profile.isf} mg/dL)`;
    if (profile.targetLow && profile.targetHigh) context += `\nTarget Range: ${profile.targetLow}-${profile.targetHigh} mg/dL`;
    
    return lang === 'en' 
        ? `You are DiaMate AI, an intelligent diabetes assistant that helps with insulin dose calculations.

DOSE CALCULATION:
- Meal Bolus = Carbs ÷ ICR
- Correction Bolus = (Current BG - Target) ÷ ISF
- Total Bolus = Meal Bolus + Correction Bolus

RULES:
- Show calculation steps clearly
- Add disclaimer: "This is a suggestion, verify with your healthcare provider"
- For hypo (<70 mg/dL): Recommend 15-20g fast carbs FIRST, no insulin
- Warn if dose >15 units (unusually high)

${context}`
        : `Sen DiaMate AI, insülin doz hesaplamalarında yardımcı olan akıllı bir diyabet asistanısın.

DOZ HESAPLAMA:
- Öğün Bolusu = Karbonhidrat ÷ ICR
- Düzeltme Bolusu = (Mevcut KŞ - Hedef) ÷ ISF
- Toplam Bolus = Öğün Bolusu + Düzeltme Bolusu

KURALLAR:
- Hesaplama adımlarını net göster
- Uyarı ekle: "Bu bir öneridir, sağlık uzmanınızla doğrulayın"
- Hipo (<70 mg/dL) için: ÖNCE 15-20g hızlı karbonhidrat öner, insülin yok
- Doz >15 ünite ise uyar (alışılmadık yüksek)

${context}`;
}

/**
 * Analyze food photo via server (or show fallback message)
 */
export async function analyzePhoto(imageDataUrl) {
    const lang = getLang();
    
    // Try server-side first
    if (!useClientSide) {
        try {
            const response = await fetch(`${API_BASE}/ai-vision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageDataUrl, lang })
            });
            
            // If 404, switch to demo mode
            if (response.status === 404) {
                useClientSide = true;
                return analyzePhotoClientSide(imageDataUrl, lang);
            }
            
            // Try to parse JSON
            let data;
            try {
                data = await response.json();
            } catch {
                // Non-JSON response
                useClientSide = true;
                return analyzePhotoClientSide(imageDataUrl, lang);
            }
            
            if (!response.ok) {
                return {
                    error: true,
                    message: handleAPIError(response.status, data, lang)
                };
            }
            
            return {
                success: true,
                items: data.items || [],
                totalCarbs: data.total_carbs_g || 0,
                notes: data.notes || '',
                confidence: data.confidence || 'medium'
            };
            
        } catch (error) {
            console.warn('Server request failed:', error.message);
            useClientSide = true;
            return analyzePhotoClientSide(imageDataUrl, lang);
        }
    }
    
    return analyzePhotoClientSide(imageDataUrl, lang);
}

/**
 * Client-side photo analysis fallback
 */
async function analyzePhotoClientSide(imageDataUrl, lang) {
    const apiKey = localStorage.getItem(API_KEY_STORAGE);
    
    if (!apiKey) {
        return {
            error: true,
            message: lang === 'en'
                ? '🚀 **Demo Mode**\n\nPhoto analysis requires Netlify deployment.\n\n**For Investors:** This demo shows the UI. Full AI photo analysis is available in production.\n\n**For Developers:** Deploy with `OPENAI_API_KEY` to enable.'
                : '🚀 **Demo Modu**\n\nFotoğraf analizi Netlify deployment gerektirir.\n\n**Yatırımcılar için:** Bu demo UI\'ı gösterir. Tam AI fotoğraf analizi production\'da mevcuttur.\n\n**Geliştiriciler için:** Etkinleştirmek için `OPENAI_API_KEY` ile deploy edin.'
        };
    }
    
    // Only OpenAI supports vision
    if (!apiKey.startsWith('sk-') || apiKey.startsWith('sk-or-')) {
        return {
            error: true,
            message: lang === 'en'
                ? '⚠️ Photo analysis requires OpenAI API key (gpt-4o).'
                : '⚠️ Fotoğraf analizi OpenAI API key (gpt-4o) gerektirir.'
        };
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: getVisionPrompt(lang) },
                        { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } }
                    ]
                }],
                max_tokens: 500
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return { error: true, message: `❌ ${data.error?.message || 'API Error'}` };
        }
        
        const aiResponse = data.choices[0].message.content;
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            return { error: true, message: '❌ Could not parse response' };
        }
        
        const result = JSON.parse(jsonMatch[0]);
        
        return {
            success: true,
            items: result.items || [],
            totalCarbs: result.total_carbs_g || 0,
            notes: result.notes || '',
            confidence: result.confidence || 'medium'
        };
    } catch (error) {
        return { error: true, message: `❌ ${error.message}` };
    }
}

function getVisionPrompt(lang) {
    return lang === 'en'
        ? 'Analyze this food photo. Return ONLY JSON: {"items":[{"name":"","portion":"","carbs_g":0,"confidence":"high|medium|low"}],"total_carbs_g":0,"notes":"","confidence":"high|medium|low"}'
        : 'Bu yemek fotoğrafını analiz et. SADECE JSON döndür: {"items":[{"name":"","portion":"","carbs_g":0,"confidence":"high|medium|low"}],"total_carbs_g":0,"notes":"","confidence":"high|medium|low"}';
}

// ==========================================
// ERROR HANDLING
// ==========================================

function handleAPIError(status, data, lang) {
    const code = data?.code || data?.error || 'unknown';
    const message = data?.message || '';
    
    switch (status) {
        case 401:
        case 403:
            return lang === 'en'
                ? '🔐 Authentication required. Please refresh the page.'
                : '🔐 Kimlik doğrulama gerekli. Sayfayı yenileyin.';
        
        case 402:
            return lang === 'en'
                ? '🔒 This feature requires PRO subscription. Upgrade to unlock!'
                : '🔒 Bu özellik PRO abonelik gerektirir. Yükseltmek için tıklayın!';
        
        case 429:
            if (code === 'quota_exceeded') {
                return lang === 'en'
                    ? '⚠️ You\'ve reached your daily limit. Upgrade to PRO for more!'
                    : '⚠️ Günlük limitinize ulaştınız. Daha fazlası için PRO\'ya yükseltin!';
            }
            return lang === 'en'
                ? '⏳ Too many requests. Please wait a moment and try again.'
                : '⏳ Çok fazla istek. Lütfen biraz bekleyin ve tekrar deneyin.';
        
        case 500:
        case 502:
        case 503:
            return lang === 'en'
                ? '❌ Server error. Please try again in a moment.'
                : '❌ Sunucu hatası. Biraz sonra tekrar deneyin.';
        
        default:
            return lang === 'en'
                ? `❌ Error: ${message || 'Something went wrong'}`
                : `❌ Hata: ${message || 'Bir şeyler yanlış gitti'}`;
    }
}

// ==========================================
// CONTEXT BUILDING
// ==========================================

function buildRecentContext() {
    const weekGlucose = listEntries('glucose', { fromTs: daysAgo(7) });
    const weekMeals = listEntries('meals', { fromTs: daysAgo(7) });
    const profile = getProfile();
    
    if (weekGlucose.length === 0) return null;
    
    const values = weekGlucose.map(g => g.value);
    const avgBG = Math.round(mean(values));
    const inRange = values.filter(v => v >= (profile.targetLow || 70) && v <= (profile.targetHigh || 180));
    const timeInRangePct = Math.round((inRange.length / values.length) * 100);
    const hypoEvents = values.filter(v => v < 70).length;
    const hyperEvents = values.filter(v => v > 250).length;
    
    return {
        stats: {
            avgBG,
            timeInRangePct,
            hypoEvents,
            hyperEvents,
            mealsLogged: weekMeals.length
        }
    };
}

// ==========================================
// LOCAL MEMORY (Conversation History)
// ==========================================

function getAIMemory() {
    try {
        const stored = localStorage.getItem(AI_MEMORY_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { conversations: [] };
}

function saveAIMemory(memory) {
    try {
        localStorage.setItem(AI_MEMORY_KEY, JSON.stringify(memory));
    } catch (e) {
        console.error('Error saving AI memory:', e);
    }
}

/**
 * Save conversation to local memory
 */
export function saveConversation(userMessage, botResponse) {
    const memory = getAIMemory();
    memory.conversations.push({
        ts: Date.now(),
        user: userMessage,
        bot: botResponse
    });
    
    // Keep only last 50 conversations
    if (memory.conversations.length > 50) {
        memory.conversations = memory.conversations.slice(-50);
    }
    
    saveAIMemory(memory);
}

/**
 * Get conversation history
 */
export function getConversationHistory(limit = 10) {
    const memory = getAIMemory();
    return memory.conversations.slice(-limit);
}

/**
 * Clear conversation history
 */
export function clearConversationHistory() {
    const memory = getAIMemory();
    memory.conversations = [];
    saveAIMemory(memory);
}

// ==========================================
// SUGGESTIONS & GREETING
// ==========================================

/**
 * Get smart suggestions based on current state
 */
export function getSmartSuggestions() {
    const suggestions = [];
    const lang = getLang();
    const todayGlucose = getTodayEntries('glucose');
    const latestGlucose = getLatestEntry('glucose');
    const hour = new Date().getHours();
    
    // Time-based suggestions
    if (hour >= 6 && hour < 9 && todayGlucose.length === 0) {
        suggestions.push({
            type: 'reminder',
            icon: '🌅',
            text: lang === 'en' ? 'Good morning! Time for fasting glucose check.' : 'Günaydın! Açlık glukoz ölçümü zamanı.',
            prompt: lang === 'en' ? 'What should my fasting glucose be?' : 'Açlık glukozum ne olmalı?'
        });
    }
    
    // Low glucose warning
    if (latestGlucose && latestGlucose.value < 80) {
        suggestions.push({
            type: 'warning',
            icon: '⚠️',
            text: lang === 'en' ? 'Your glucose is getting low' : 'Glukozunuz düşüyor',
            prompt: lang === 'en' ? 'My glucose is low, what should I do?' : 'Glukozum düşük, ne yapmalıyım?'
        });
    }
    
    // High glucose
    if (latestGlucose && latestGlucose.value > 200) {
        suggestions.push({
            type: 'warning',
            icon: '📈',
            text: lang === 'en' ? 'Your glucose is high' : 'Glukozunuz yüksek',
            prompt: lang === 'en' ? 'My glucose is high, how can I bring it down?' : 'Glukozum yüksek, nasıl düşürebilirim?'
        });
    }
    
    // General suggestions
    if (suggestions.length === 0) {
        suggestions.push({
            type: 'tip',
            icon: '💡',
            text: lang === 'en' ? 'Ask me anything about diabetes' : 'Diyabet hakkında her şeyi sorabilirsiniz',
            prompt: lang === 'en' ? 'Give me tips for better glucose control' : 'Daha iyi glukoz kontrolü için ipuçları ver'
        });
    }
    
    return suggestions.slice(0, 3);
}

/**
 * Get personalized greeting
 */
export function getPersonalizedGreeting() {
    const profile = getProfile();
    const name = profile.name?.split(' ')[0] || '';
    const hour = new Date().getHours();
    const lang = getLang();
    
    let timeGreeting;
    if (lang === 'en') {
        if (hour < 12) timeGreeting = 'Good morning';
        else if (hour < 18) timeGreeting = 'Good afternoon';
        else timeGreeting = 'Good evening';
    } else {
        if (hour < 12) timeGreeting = 'Günaydın';
        else if (hour < 18) timeGreeting = 'İyi günler';
        else timeGreeting = 'İyi akşamlar';
    }
    
    const greeting = name ? `${timeGreeting}, ${name}!` : `${timeGreeting}!`;
    
    return lang === 'en'
        ? `${greeting} 👋 I'm your DiaMate AI assistant. I can help you with diabetes management, answer questions, and provide personalized advice based on your data. How can I help you today?`
        : `${greeting} 👋 Ben DiaMate AI asistanınızım. Diyabet yönetiminde size yardımcı olabilir, sorularınızı yanıtlayabilir ve verilerinize göre kişiselleştirilmiş tavsiyeler sunabilirim. Bugün size nasıl yardımcı olabilirim?`;
}

// Legacy exports for compatibility (no-ops)
export function getApiKey() { return ''; }
export function setApiKey() {}
export function getProvider() { return 'server'; }
