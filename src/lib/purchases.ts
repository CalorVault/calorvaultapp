import { Linking, Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PURCHASES_ERROR_CODE,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

/**
 * Public RevenueCat SDK key -- safe to embed in the client, same as a
 * Stripe publishable key. This is the iOS app key from the CalorVault
 * RevenueCat project; add an Android key here too once that platform
 * is set up.
 */
const REVENUECAT_API_KEY_IOS = 'appl_qaQakiJCtxVEbJEDEvhtUgZZpwH';

/** Must match the Entitlement identifier configured in the RevenueCat dashboard. */
export const PREMIUM_ENTITLEMENT_ID = 'calorvault_pro';

export class PurchasesError extends Error {}
export class PurchasesCancelledError extends PurchasesError {}

let configured = false;

/** react-native-purchases is a native module; there's no build of it for web. */
export function isPurchasesSupported(): boolean {
  return Platform.OS !== 'web';
}

async function ensureConfigured(): Promise<void> {
  if (configured) return;
  if (!isPurchasesSupported()) {
    throw new PurchasesError('In-app purchases are not available on this platform.');
  }
  try {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
    configured = true;
  } catch (err) {
    throw new PurchasesError(
      err instanceof Error ? err.message : 'Could not initialize in-app purchases.'
    );
  }
}

export function hasPremiumEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

/** Returns null if purchases aren't configured yet, rather than throwing -- used for the initial silent check on app launch. */
export async function getCustomerInfoSilently(): Promise<CustomerInfo | null> {
  if (!isPurchasesSupported()) return null;
  try {
    await ensureConfigured();
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/** The "current" offering configured in the RevenueCat dashboard, or null if none exists yet. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  await ensureConfigured();
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  await ensureConfigured();
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (err: any) {
    if (err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      throw new PurchasesCancelledError('Purchase cancelled.');
    }
    throw new PurchasesError(err instanceof Error ? err.message : 'Purchase failed.');
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  await ensureConfigured();
  try {
    return await Purchases.restorePurchases();
  } catch (err) {
    throw new PurchasesError(err instanceof Error ? err.message : 'Restore failed.');
  }
}

/**
 * Apple requires cancellation to go through the native subscription management
 * screen -- an app can't cancel a subscription on the user's behalf.
 */
export async function openManageSubscriptions(): Promise<void> {
  const url =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
  await Linking.openURL(url);
}
