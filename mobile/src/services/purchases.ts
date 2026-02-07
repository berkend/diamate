/**
 * DiaMate In-App Purchases Service
 * Uses react-native-iap for Apple IAP & Google Play Billing
 * Falls back to placeholder if not available (Expo Go)
 */
import { Platform } from 'react-native';
import { useAppStore } from '../store/appStore';
import { Entitlement } from '../types';
import { apiRequest } from './api';

// Product IDs - must match App Store Connect & Google Play Console
export const PRODUCTS = {
  PRO_MONTHLY: Platform.OS === 'ios' 
    ? 'com.diamate.pro.monthly' 
    : 'diamate_pro_monthly',
  PRO_YEARLY: Platform.OS === 'ios' 
    ? 'com.diamate.pro.yearly' 
    : 'diamate_pro_yearly',
};

let iapModule: any = null;
let isInitialized = false;

/**
 * Initialize purchases
 */
export async function initPurchases(): Promise<void> {
  if (isInitialized) return;
  
  try {
    // Dynamic import - won't crash if not installed
    iapModule = require('react-native-iap');
    await iapModule.initConnection();
    isInitialized = true;
    console.log('IAP initialized');
  } catch (e) {
    console.log('IAP not available (Expo Go?), using placeholder');
    isInitialized = true;
  }
}

/**
 * Check current subscription status
 */
export async function checkSubscriptionStatus(): Promise<Entitlement> {
  return useAppStore.getState().entitlement;
}

/**
 * Get available packages
 */
export async function getPackages(): Promise<any[]> {
  if (!iapModule) {
    // Placeholder packages for demo/Expo Go
    return [
      {
        identifier: 'pro_monthly',
        product: {
          identifier: PRODUCTS.PRO_MONTHLY,
          title: 'DiaMate Pro Aylık',
          description: 'Sınırsız AI sohbet ve fotoğraf analizi',
          priceString: '₺99,99/ay',
          price: 99.99,
        },
      },
      {
        identifier: 'pro_yearly',
        product: {
          identifier: PRODUCTS.PRO_YEARLY,
          title: 'DiaMate Pro Yıllık',
          description: 'Sınırsız erişim - %40 indirim',
          priceString: '₺699,99/yıl',
          price: 699.99,
        },
      },
    ];
  }

  try {
    const productIds = [PRODUCTS.PRO_MONTHLY, PRODUCTS.PRO_YEARLY];
    const subscriptions = await iapModule.getSubscriptions({ skus: productIds });
    
    return subscriptions.map((sub: any) => ({
      identifier: sub.productId.includes('yearly') ? 'pro_yearly' : 'pro_monthly',
      product: {
        identifier: sub.productId,
        title: sub.title || sub.productId,
        description: sub.description || '',
        priceString: sub.localizedPrice || `${sub.price} ${sub.currency}`,
        price: parseFloat(sub.price) || 0,
      },
    }));
  } catch (e) {
    console.error('Failed to get subscriptions:', e);
    return [];
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(pkg: any): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!iapModule) {
    return { success: false, error: 'Satın alma bu ortamda kullanılamıyor. Lütfen App Store/Play Store\'dan indirilen uygulamayı kullanın.' };
  }

  try {
    const productId = pkg.product.identifier;
    
    let purchase;
    if (Platform.OS === 'ios') {
      purchase = await iapModule.requestSubscription({ sku: productId });
    } else {
      purchase = await iapModule.requestSubscription({
        subscriptionOffers: [{ sku: productId, offerToken: '' }],
      });
    }

    if (purchase) {
      // Verify with backend
      const transactionId = Platform.OS === 'ios' 
        ? purchase.transactionId 
        : purchase.purchaseToken;

      const result = await verifyPurchase(
        Platform.OS,
        productId,
        transactionId,
        Platform.OS === 'android' ? purchase.purchaseToken : undefined
      );

      if (result.verified) {
        // Update local entitlement
        useAppStore.getState().setEntitlement({
          isPro: true,
          plan: 'PRO',
          quotas: { chatPerDay: 999, visionPerDay: 999, pdfExport: true, doctorShare: true, cloudSync: true, reminders: 999 },
          usage: useAppStore.getState().entitlement.usage,
        });

        // Finish transaction
        if (Platform.OS === 'ios') {
          await iapModule.finishTransaction({ purchase, isConsumable: false });
        } else {
          await iapModule.acknowledgePurchaseAndroid({ token: purchase.purchaseToken });
        }

        return { success: true };
      }
    }

    return { success: false, error: 'Satın alma doğrulanamadı' };
  } catch (e: any) {
    if (e.code === 'E_USER_CANCELLED') {
      return { success: false, error: 'cancelled' };
    }
    console.error('Purchase error:', e);
    return { success: false, error: e.message || 'Satın alma başarısız' };
  }
}

/**
 * Verify purchase with backend
 */
async function verifyPurchase(
  platform: string,
  productId: string,
  transactionId: string,
  purchaseToken?: string
): Promise<{ verified: boolean; isPro: boolean }> {
  try {
    return await apiRequest('/iap-verify', {
      method: 'POST',
      body: JSON.stringify({
        platform,
        productId,
        transactionId,
        purchaseToken,
      }),
    });
  } catch (e) {
    console.error('Verify error:', e);
    return { verified: false, isPro: false };
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  isPro: boolean;
  error?: string;
}> {
  if (!iapModule) {
    return { success: false, isPro: false, error: 'Bu ortamda kullanılamıyor' };
  }

  try {
    const purchases = await iapModule.getAvailablePurchases();
    
    if (purchases && purchases.length > 0) {
      // Find the most recent PRO purchase
      const proPurchase = purchases.find((p: any) => 
        p.productId.includes('pro')
      );

      if (proPurchase) {
        const transactionId = Platform.OS === 'ios'
          ? proPurchase.transactionId
          : proPurchase.purchaseToken;

        const result = await verifyPurchase(
          Platform.OS,
          proPurchase.productId,
          transactionId,
          Platform.OS === 'android' ? proPurchase.purchaseToken : undefined
        );

        if (result.verified && result.isPro) {
          useAppStore.getState().setEntitlement({
            isPro: true,
            plan: 'PRO',
            quotas: { chatPerDay: 999, visionPerDay: 999, pdfExport: true, doctorShare: true, cloudSync: true, reminders: 999 },
            usage: useAppStore.getState().entitlement.usage,
          });
          return { success: true, isPro: true };
        }
      }
    }

    return { success: true, isPro: false };
  } catch (e: any) {
    console.error('Restore error:', e);
    return { success: false, isPro: false, error: e.message };
  }
}

/**
 * Set user ID for purchase tracking
 */
export async function setUserId(userId: string): Promise<void> {
  console.log('Purchase user ID set:', userId);
}

/**
 * Clear user ID
 */
export async function clearUserId(): Promise<void> {
  console.log('Purchase user ID cleared');
}

/**
 * Get subscription management URL
 */
export function getManageSubscriptionUrl(): string {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}
