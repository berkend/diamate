/**
 * DiaMate In-App Purchases Service
 * Placeholder - RevenueCat will be configured later
 */
import { Platform, Linking } from 'react-native';
import { useAppStore } from '../store/appStore';
import { Entitlement } from '../types';

// Product IDs
export const PRODUCTS = {
  PRO_MONTHLY: 'diamate_pro_monthly',
  PRO_YEARLY: 'diamate_pro_yearly',
};

let isInitialized = false;

/**
 * Initialize purchases (placeholder)
 */
export async function initPurchases(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;
  console.log('Purchases service initialized (placeholder)');
}

/**
 * Check current subscription status
 */
export async function checkSubscriptionStatus(): Promise<Entitlement> {
  return useAppStore.getState().entitlement;
}

/**
 * Get available packages (placeholder)
 */
export async function getPackages(): Promise<any[]> {
  return [
    {
      identifier: 'pro_monthly',
      product: {
        identifier: PRODUCTS.PRO_MONTHLY,
        title: 'DiaMate Pro Aylık',
        description: 'Sınırsız AI sohbet ve fotoğraf analizi',
        priceString: '₺99,99/ay',
      },
    },
    {
      identifier: 'pro_yearly',
      product: {
        identifier: PRODUCTS.PRO_YEARLY,
        title: 'DiaMate Pro Yıllık',
        description: 'Sınırsız AI sohbet ve fotoğraf analizi - %40 indirim',
        priceString: '₺699,99/yıl',
      },
    },
  ];
}

/**
 * Purchase a package (placeholder)
 */
export async function purchasePackage(pkg: any): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('Purchase requested:', pkg);
  return { success: false, error: 'Satın alma henüz yapılandırılmadı' };
}

/**
 * Restore purchases (placeholder)
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  isPro: boolean;
  error?: string;
}> {
  return { success: false, isPro: false, error: 'Geri yükleme henüz yapılandırılmadı' };
}

/**
 * Set user ID (placeholder)
 */
export async function setUserId(userId: string): Promise<void> {
  console.log('User ID set:', userId);
}

/**
 * Clear user ID (placeholder)
 */
export async function clearUserId(): Promise<void> {
  console.log('User ID cleared');
}

/**
 * Get subscription management URL
 */
export function getManageSubscriptionUrl(): string {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}
