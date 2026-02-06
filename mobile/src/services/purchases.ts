/**
 * DiaMate In-App Purchases Service
 * Uses RevenueCat for cross-platform subscription management
 * Handles iOS StoreKit 2 and Google Play Billing
 */
import Purchases, { 
  PurchasesPackage, 
  CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { useAppStore } from '../store/appStore';
import { verifyApplePurchase, verifyGooglePurchase } from './api';
import { Entitlement } from '../types';

// RevenueCat API Keys (from app config)
const REVENUECAT_IOS_KEY = 'appl_your_ios_key';
const REVENUECAT_ANDROID_KEY = 'goog_your_android_key';

// Product IDs
export const PRODUCTS = {
  PRO_MONTHLY: 'diamate_pro_monthly',
  PRO_YEARLY: 'diamate_pro_yearly',
};

// Entitlement ID in RevenueCat
const PRO_ENTITLEMENT = 'pro';

let isInitialized = false;

/**
 * Initialize RevenueCat
 */
export async function initPurchases(): Promise<void> {
  if (isInitialized) return;

  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
    
    await Purchases.configure({ apiKey });
    
    // Listen for customer info updates
    Purchases.addCustomerInfoUpdateListener(handleCustomerInfoUpdate);
    
    isInitialized = true;
    
    // Check initial status
    await checkSubscriptionStatus();
  } catch (error) {
    console.error('Failed to initialize purchases:', error);
  }
}

/**
 * Handle customer info updates (subscription changes)
 */
function handleCustomerInfoUpdate(customerInfo: CustomerInfo) {
  const entitlement = mapCustomerInfoToEntitlement(customerInfo);
  useAppStore.getState().setEntitlement(entitlement);
}

/**
 * Map RevenueCat CustomerInfo to our Entitlement type
 */
function mapCustomerInfoToEntitlement(customerInfo: CustomerInfo): Entitlement {
  const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT];
  const isPro = !!proEntitlement;
  
  let plan: 'FREE' | 'PRO_MONTHLY' | 'PRO_YEARLY' = 'FREE';
  if (isPro) {
    plan = proEntitlement.productIdentifier.includes('yearly') 
      ? 'PRO_YEARLY' 
      : 'PRO_MONTHLY';
  }

  const today = new Date().toISOString().split('T')[0];
  const currentUsage = useAppStore.getState().entitlement.usage;
  
  // Reset usage if new day
  const usage = currentUsage.lastResetDate === today
    ? currentUsage
    : { dailyChatCount: 0, dailyVisionCount: 0, lastResetDate: today };

  return {
    isPro,
    plan,
    expiresAt: proEntitlement?.expirationDate || undefined,
    quotas: isPro
      ? { chatPerDay: 500, visionPerDay: 200 }
      : { chatPerDay: 5, visionPerDay: 0 },
    usage,
  };
}

/**
 * Check current subscription status
 */
export async function checkSubscriptionStatus(): Promise<Entitlement> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = mapCustomerInfoToEntitlement(customerInfo);
    useAppStore.getState().setEntitlement(entitlement);
    return entitlement;
  } catch (error) {
    console.error('Failed to check subscription:', error);
    return useAppStore.getState().entitlement;
  }
}

/**
 * Get available packages (subscription options)
 */
export async function getPackages(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages || [];
  } catch (error) {
    console.error('Failed to get packages:', error);
    return [];
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    
    // Verify purchase on our server
    const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT];
    if (proEntitlement) {
      const transactionId = proEntitlement.originalPurchaseDate;
      
      if (Platform.OS === 'ios') {
        // iOS verification
        await verifyApplePurchase(
          proEntitlement.productIdentifier,
          '' // Receipt handled by RevenueCat
        );
      } else {
        // Android verification
        await verifyGooglePurchase(
          proEntitlement.productIdentifier,
          '' // Token handled by RevenueCat
        );
      }
    }
    
    // Update local state
    const entitlement = mapCustomerInfoToEntitlement(customerInfo);
    useAppStore.getState().setEntitlement(entitlement);
    
    return { success: true };
  } catch (error: any) {
    if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { success: false, error: 'cancelled' };
    }
    console.error('Purchase failed:', error);
    return { success: false, error: error.message };
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
  try {
    const customerInfo = await Purchases.restorePurchases();
    const entitlement = mapCustomerInfoToEntitlement(customerInfo);
    useAppStore.getState().setEntitlement(entitlement);
    
    return { success: true, isPro: entitlement.isPro };
  } catch (error: any) {
    console.error('Restore failed:', error);
    return { success: false, isPro: false, error: error.message };
  }
}

/**
 * Set user ID for RevenueCat (after auth)
 */
export async function setUserId(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.error('Failed to set user ID:', error);
  }
}

/**
 * Clear user ID (on logout)
 */
export async function clearUserId(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Failed to clear user ID:', error);
  }
}

/**
 * Get subscription management URL
 */
export function getManageSubscriptionUrl(): string {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}
