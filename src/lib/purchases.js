import { Capacitor } from '@capacitor/core';

// The RevenueCat *public* iOS key (safe to ship in the app). Set VITE_REVENUECAT_IOS_KEY in Vercel.
const API_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY || '';

const ORDER = ['month', 'quarter', 'year'];
let plugin = null;      // the native plugin, loaded only when needed
let configured = false;

/** True only inside the iPhone app, with a key set and the native part present in this build. */
export function purchasesAvailable() {
  return !!API_KEY && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
    && Capacitor.isPluginAvailable('Purchases');
}

async function load() {
  if (!plugin) plugin = (await import('@revenuecat/purchases-capacitor')).Purchases;
  return plugin;
}

/** Starts RevenueCat for this signed-in person (their account id links purchases to their account). */
export async function initPurchases(userId) {
  if (!purchasesAvailable() || !userId) return false;
  const Purchases = await load();
  if (!configured) {
    await Purchases.configure({ apiKey: API_KEY, appUserID: userId });
    configured = true;
  } else {
    await Purchases.logIn({ appUserID: userId });
  }
  return true;
}

/** The plans to show, with the real prices from the App Store. */
export async function loadPlans() {
  const Purchases = await load();
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages || [];
  return packages
    .map((pkg) => {
      const id = String(pkg.product?.identifier || '').toLowerCase();
      const period = pkg.packageType === 'ANNUAL' || id.includes('year') ? 'year'
        : pkg.packageType === 'THREE_MONTH' || id.includes('quarter') ? 'quarter'
        : pkg.packageType === 'MONTHLY' || id.includes('month') ? 'month' : null;
      return period && { pkg, period, priceString: pkg.product.priceString, perMonth: pkg.product.pricePerMonthString };
    })
    .filter(Boolean)
    .sort((a, b) => ORDER.indexOf(a.period) - ORDER.indexOf(b.period));
}

/** Resolves true when the purchase went through, false if the person cancelled. Throws on a real error. */
export async function buy(plan) {
  const Purchases = await load();
  try {
    await Purchases.purchasePackage({ aPackage: plan.pkg });
    return true;
  } catch (err) {
    if (err?.userCancelled) return false;
    throw err;
  }
}

export async function restore() {
  const Purchases = await load();
  await Purchases.restorePurchases();
}

const withTimeout = (promise, ms, label) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label}: no answer in ${ms / 1000}s`)), ms))]);

/** One line explaining why plans did not load: does Apple return the products, and does RevenueCat have an offering? */
export async function diagnose() {
  const parts = [];
  try {
    const Purchases = await load();
    try {
      const r = await withTimeout(Purchases.getProducts({
        productIdentifiers: ['com.johmacos.secretary.pro.monthly', 'com.johmacos.secretary.pro.quarterly'],
        type: 'SUBS',
      }), 25000, 'Apple products');
      parts.push(`Apple returned ${r.products?.length ?? 0}/2 products`);
    } catch (e) { parts.push(`Apple products error: ${e?.message || e}`); }
    try {
      const o = await withTimeout(Purchases.getOfferings(), 25000, 'RevenueCat offerings');
      parts.push(`offering ${o.current?.identifier || 'none'}, ${o.current?.availablePackages?.length ?? 0} packages`);
    } catch (e) { parts.push(`offerings error: ${e?.message || e}`); }
  } catch (e) { parts.push(`plugin error: ${e?.message || e}`); }
  return parts.join(' | ');
}
