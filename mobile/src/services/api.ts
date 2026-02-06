/**
 * DiaMate API Service
 * All AI calls go through server - NO client-side API keys
 */
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { 
  AIChatRequest, 
  AIChatResponse, 
  AIVisionRequest, 
  AIVisionResponse,
  Entitlement 
} from '../types';

// API Base URL from app.json extra
const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'https://diamate.org/.netlify/functions';

// Auth token storage
const AUTH_TOKEN_KEY = 'diamate_auth_token';

/**
 * Get stored auth token
 */
async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Store auth token
 */
export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

/**
 * Clear auth token
 */
export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new APIError(response.status, error.message || 'Request failed', error.code);
  }

  return response.json();
}

/**
 * Custom API Error
 */
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// ==========================================
// ENTITLEMENT
// ==========================================

/**
 * Get user entitlement (PRO status, quotas)
 */
export async function getEntitlement(): Promise<Entitlement> {
  try {
    return await apiRequest<Entitlement>('/entitlement');
  } catch (error) {
    // Return default FREE entitlement on error
    return {
      isPro: false,
      plan: 'FREE',
      quotas: { chatPerDay: 5, visionPerDay: 0 },
      usage: { 
        dailyChatCount: 0, 
        dailyVisionCount: 0, 
        lastResetDate: new Date().toISOString().split('T')[0] 
      },
    };
  }
}

// ==========================================
// AI CHAT
// ==========================================

/**
 * Send chat message to AI (server-side)
 * User NEVER sees API key
 */
export async function sendChatMessage(request: AIChatRequest): Promise<AIChatResponse> {
  try {
    const response = await apiRequest<AIChatResponse>('/ai-chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response;
  } catch (error) {
    if (error instanceof APIError) {
      return handleAPIError(error, request.lang);
    }
    return {
      text: request.lang === 'en' 
        ? '❌ Connection error. Please check your internet and try again.'
        : '❌ Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.',
      error: 'connection_error',
    };
  }
}

/**
 * Handle API errors with user-friendly messages
 */
function handleAPIError(error: APIError, lang: 'tr' | 'en'): AIChatResponse {
  const messages: Record<number, { tr: string; en: string }> = {
    401: {
      tr: '🔐 Oturum süresi doldu. Lütfen tekrar giriş yapın.',
      en: '🔐 Session expired. Please log in again.',
    },
    402: {
      tr: '🔒 Bu özellik PRO abonelik gerektirir. Yükseltmek için tıklayın!',
      en: '🔒 This feature requires PRO subscription. Tap to upgrade!',
    },
    429: {
      tr: '⚠️ Günlük limitinize ulaştınız. PRO\'ya yükseltin veya yarın tekrar deneyin.',
      en: '⚠️ Daily limit reached. Upgrade to PRO or try again tomorrow.',
    },
    500: {
      tr: '❌ Sunucu hatası. Lütfen biraz sonra tekrar deneyin.',
      en: '❌ Server error. Please try again in a moment.',
    },
  };

  const msg = messages[error.status] || {
    tr: `❌ Hata: ${error.message}`,
    en: `❌ Error: ${error.message}`,
  };

  return {
    text: lang === 'en' ? msg.en : msg.tr,
    error: error.code || `http_${error.status}`,
  };
}

// ==========================================
// AI VISION (Photo Analysis)
// ==========================================

/**
 * Analyze food photo via AI (server-side)
 * User NEVER sees API key
 */
export async function analyzePhoto(request: AIVisionRequest): Promise<AIVisionResponse> {
  try {
    const response = await apiRequest<AIVisionResponse>('/ai-vision', {
      method: 'POST',
      body: JSON.stringify({
        imageDataUrl: request.imageBase64.startsWith('data:') 
          ? request.imageBase64 
          : `data:image/jpeg;base64,${request.imageBase64}`,
        lang: request.lang,
      }),
    });
    return response;
  } catch (error) {
    if (error instanceof APIError) {
      if (error.status === 402) {
        return {
          items: [],
          total_carbs_g: 0,
          notes: request.lang === 'en'
            ? '🔒 Photo analysis requires PRO subscription.'
            : '🔒 Fotoğraf analizi PRO abonelik gerektirir.',
          confidence: 'low',
          error: 'pro_required',
        };
      }
      if (error.status === 429) {
        return {
          items: [],
          total_carbs_g: 0,
          notes: request.lang === 'en'
            ? '⚠️ Daily photo analysis limit reached.'
            : '⚠️ Günlük fotoğraf analizi limitine ulaşıldı.',
          confidence: 'low',
          error: 'quota_exceeded',
        };
      }
    }
    return {
      items: [],
      total_carbs_g: 0,
      notes: request.lang === 'en'
        ? '❌ Analysis failed. Please try again.'
        : '❌ Analiz başarısız. Tekrar deneyin.',
      confidence: 'low',
      error: 'analysis_failed',
    };
  }
}

// ==========================================
// IAP VERIFICATION
// ==========================================

/**
 * Verify iOS App Store purchase
 */
export async function verifyApplePurchase(transactionId: string, receipt: string): Promise<boolean> {
  try {
    const response = await apiRequest<{ valid: boolean }>('/iap-apple-verify', {
      method: 'POST',
      body: JSON.stringify({ transactionId, receipt }),
    });
    return response.valid;
  } catch {
    return false;
  }
}

/**
 * Verify Google Play purchase
 */
export async function verifyGooglePurchase(
  productId: string, 
  purchaseToken: string
): Promise<boolean> {
  try {
    const response = await apiRequest<{ valid: boolean }>('/iap-google-verify', {
      method: 'POST',
      body: JSON.stringify({ productId, purchaseToken }),
    });
    return response.valid;
  } catch {
    return false;
  }
}

// ==========================================
// HEALTH DATA SYNC
// ==========================================

/**
 * Sync health data to server (optional, for backup)
 */
export async function syncHealthData(data: {
  glucoseReadings: any[];
  mealLogs: any[];
}): Promise<void> {
  await apiRequest('/health-sync', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get health summary for AI context
 */
export async function getHealthSummary(): Promise<object> {
  try {
    return await apiRequest('/health-summary');
  } catch {
    return {};
  }
}
