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
    try { await Purchases.setLogLevel({ level: 'DEBUG' }); } catch { /* older native build */ }
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

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`no answer in ${ms / 1000}s`)), ms))]);

/**
 * Step-by-step self-test. Calls onLine(text) as each step starts and finishes, so the screen shows exactly
 * where it stops: the plugin, RevenueCat's servers, or Apple's product lookup.
 */
export async function runDiagnostics(onLine, userId) {
  const step = async (name, fn, ms = 20000) => {
    const t0 = Date.now();
    onLine(`${name}: …`);
    try {
      const out = await withTimeout(fn(), ms);
      onLine(`${name}: OK ${Date.now() - t0}ms${out ? ` (${out})` : ''}`, true);
    } catch (e) {
      onLine(`${name}: FAILED ${Date.now() - t0}ms (${String(e?.message || e).slice(0, 160)})`, true);
    }
  };
  let P;
  await step('1 plugin loads', async () => { P = await load(); return Capacitor.getPlatform(); }, 8000);
  if (!P) return;
  await step('2 RevenueCat configured', async () => { await initPurchases(userId); return `key ${API_KEY.slice(0, 5)}…${API_KEY.slice(-4)}`; });
  await step('3 RevenueCat servers', async () => { const r = await P.getCustomerInfo(); return `user ${String(r.customerInfo?.originalAppUserId || '').slice(0, 8)}`; });
  await step('4 Apple products', async () => {
    const r = await P.getProducts({ productIdentifiers: ['com.johmacos.secretary.pro.monthly', 'com.johmacos.secretary.pro.quarterly'], type: 'SUBS' });
    return `${r.products?.length ?? 0} of 2 returned`;
  }, 30000);
  await step('5 Offerings', async () => { const o = await P.getOfferings(); return `current=${o.current?.identifier || 'none'}, ${o.current?.availablePackages?.length ?? 0} packages`; }, 30000);
}
