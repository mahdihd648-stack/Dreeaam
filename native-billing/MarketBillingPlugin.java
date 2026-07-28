package billing;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Bundle;
import android.os.IBinder;
import android.os.RemoteException;

import android.util.Log;

import com.android.vending.billing.IInAppBillingService;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * پلاگین پرداخت درون‌برنامه‌ای برای مایکت (Myket).
 * مایکت دقیقاً همون AIDL قدیمی گوگل‌پلی (v3) رو با پکیج com.android.vending.billing
 * پیاده‌سازی کرده، برای همین این پلاگین مستقیم به سرویس بیلینگ مایکت وصل می‌شه.
 *
 * توجه: نسخه‌ی قبلی این پلاگین از کافه‌بازار هم پشتیبانی می‌کرد؛ چون فعلاً قراره
 * انتشار فقط رو مایکت باشه، اون بخش‌ها حذف شدن. اگه بعداً خواستی بازار رو هم اضافه
 * کنی، کافیه یه ثابتِ پکیج/اکشنِ بازار و یه شاخه‌ی دوم تو ensureBound/detectStore
 * برگردونی؛ بقیه‌ی کد (purchase/getPurchases/consumePurchase) بدون تغییر کار می‌کنه.
 *
 * متدهای در دسترس از سمت JS (Capacitor.Plugins.MarketBilling):
 *   purchase({sku})        -> {sku, purchaseToken, orderId, store}
 *   getPurchases()          -> {purchases: [{sku, purchaseToken, orderId, store}, ...]}
 *   consumePurchase({purchaseToken}) -> {success: boolean}
 *   getStore()              -> {store: "myket" | "none"}
 */
@CapacitorPlugin(name = "MarketBilling")
public class MarketBillingPlugin extends Plugin {

    private static final String TAG = "MarketBillingPlugin";
    private static final String MYKET_PACKAGE = "ir.mservices.market";
    private static final String MYKET_BIND_ACTION = "ir.mservices.market.InAppBillingService.BIND";
    private static final int PURCHASE_REQUEST_CODE = 10011;
    // Was 6000ms — bumped up because some OEM skins (MIUI in particular, relevant since
    // one of the review devices is a Xiaomi/Poco) can be slower to spin up a bound service
    // than stock Android, and a bind that "would have succeeded" at 7-8s was silently
    // reported as "Myket not available" with no way to tell the two cases apart.
    private static final long BIND_TIMEOUT_MS = 10000;

    private IInAppBillingService billingService;
    private ServiceConnection serviceConnection;
    private String boundStore; // "myket" | null
    private String pendingPurchaseCallId;

    @Override
    public void load() {
        // زودتر تشخیص بده مایکت رو گوشی هست یا نه (فقط تشخیص، بایند واقعی موقع اولین
        // درخواست خرید انجام می‌شه) تا getStore() سریع جواب بده.
        boundStore = detectStore();
    }

    @PluginMethod
    public void getStore(PluginCall call) {
        if (boundStore == null) boundStore = detectStore();
        JSObject ret = new JSObject();
        ret.put("store", boundStore == null ? "none" : boundStore);
        call.resolve(ret);
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String sku = call.getString("sku");
        Log.d(TAG, "purchase() called, sku=" + sku);
        if (sku == null || sku.isEmpty()) {
            call.reject("sku is required");
            return;
        }
        if (!ensureBound()) {
            Log.e(TAG, "purchase() aborted — ensureBound() returned false (see preceding logs for why)");
            call.reject("مایکت رو این گوشی در دسترس نیست");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            Log.e(TAG, "purchase() aborted — getActivity() returned null");
            call.reject("no activity");
            return;
        }
        try {
            Bundle buyIntentBundle = billingService.getBuyIntent(3, activity.getPackageName(), sku, "inapp", "");
            int response = buyIntentBundle.getInt("RESPONSE_CODE", -1);
            Log.d(TAG, "getBuyIntent() RESPONSE_CODE=" + response + " for sku=" + sku + " pkg=" + activity.getPackageName());
            if (response != 0) {
                // Common causes worth checking manually when this shows up in logcat:
                //  3 (BILLING_UNAVAILABLE) — API version/type not supported
                //  4 (ITEM_UNAVAILABLE)    — this sku isn't registered in the Myket panel
                //  7 (ITEM_ALREADY_OWNED)  — an un-consumed purchase of this sku already exists
                call.reject("خطای بیلینگ، کد پاسخ " + response);
                return;
            }
            PendingIntent pendingIntent;
            if (android.os.Build.VERSION.SDK_INT >= 33) {
                pendingIntent = buyIntentBundle.getParcelable("BUY_INTENT", PendingIntent.class);
            } else {
                pendingIntent = buyIntentBundle.getParcelable("BUY_INTENT");
            }
            if (pendingIntent == null) {
                Log.e(TAG, "getBuyIntent() returned RESPONSE_CODE=0 but no BUY_INTENT — unexpected");
                call.reject("قصد خرید (buy intent) برنگشت");
                return;
            }
            bridge.saveCall(call);
            pendingPurchaseCallId = call.getCallbackId();
            Log.d(TAG, "launching Myket checkout screen for sku=" + sku);
            activity.startIntentSenderForResult(
                pendingIntent.getIntentSender(), PURCHASE_REQUEST_CODE, new Intent(), 0, 0, 0
            );
        } catch (RemoteException e) {
            Log.e(TAG, "getBuyIntent() threw RemoteException", e);
            call.reject("ارتباط با سرویس فروشگاه قطع شد: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "purchase() threw unexpected exception", e);
            call.reject("خرید انجام نشد: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != PURCHASE_REQUEST_CODE) return;
        String callId = pendingPurchaseCallId;
        pendingPurchaseCallId = null;
        if (callId == null) return;
        PluginCall call = bridge.getSavedCall(callId);
        if (call == null) return;

        Log.d(TAG, "handleOnActivityResult resultCode=" + resultCode + " (RESULT_OK=" + Activity.RESULT_OK + ")");
        if (data == null || resultCode != Activity.RESULT_OK) {
            call.reject("خرید لغو شد");
            bridge.releaseCall(call);
            return;
        }
        int responseCode = data.getIntExtra("RESPONSE_CODE", -1);
        String purchaseData = data.getStringExtra("INAPP_PURCHASE_DATA");
        Log.d(TAG, "handleOnActivityResult RESPONSE_CODE=" + responseCode + " purchaseData present=" + (purchaseData != null));
        if (responseCode != 0 || purchaseData == null) {
            call.reject("خرید لغو شد یا ناموفق بود");
            bridge.releaseCall(call);
            return;
        }
        try {
            JSONObject purchaseJson = new JSONObject(purchaseData);
            JSObject result = new JSObject();
            result.put("sku", purchaseJson.optString("productId"));
            result.put("purchaseToken", purchaseJson.optString("purchaseToken"));
            result.put("orderId", purchaseJson.optString("orderId"));
            result.put("store", boundStore);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("پاسخ خرید قابل خوندن نبود: " + e.getMessage());
        } finally {
            bridge.releaseCall(call);
        }
    }

    @PluginMethod
    public void getPurchases(PluginCall call) {
        if (!ensureBound()) {
            call.reject("مایکت رو این گوشی در دسترس نیست");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }
        try {
            JSArray results = new JSArray();
            String continuationToken = null;
            do {
                Bundle owned = billingService.getPurchases(3, activity.getPackageName(), "inapp", continuationToken);
                int response = owned.getInt("RESPONSE_CODE", -1);
                if (response != 0) break;
                ArrayList<String> purchaseDataList = owned.getStringArrayList("INAPP_PURCHASE_DATA_LIST");
                if (purchaseDataList != null) {
                    for (String item : purchaseDataList) {
                        try {
                            JSONObject purchaseJson = new JSONObject(item);
                            JSObject o = new JSObject();
                            o.put("sku", purchaseJson.optString("productId"));
                            o.put("purchaseToken", purchaseJson.optString("purchaseToken"));
                            o.put("orderId", purchaseJson.optString("orderId"));
                            o.put("store", boundStore);
                            results.put(o);
                        } catch (Exception ignored) {
                            // یه آیتم خراب نباید کل لیست رو خراب کنه
                        }
                    }
                }
                continuationToken = owned.getString("INAPP_CONTINUATION_TOKEN");
            } while (continuationToken != null);

            JSObject ret = new JSObject();
            ret.put("purchases", results);
            call.resolve(ret);
        } catch (RemoteException e) {
            call.reject("گرفتن لیست خریدها ناموفق بود: " + e.getMessage());
        }
    }

    @PluginMethod
    public void consumePurchase(PluginCall call) {
        String token = call.getString("purchaseToken");
        if (token == null || token.isEmpty()) {
            call.reject("purchaseToken is required");
            return;
        }
        if (!ensureBound()) {
            call.reject("مایکت رو این گوشی در دسترس نیست");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }
        try {
            int response = billingService.consumePurchase(3, activity.getPackageName(), token);
            JSObject ret = new JSObject();
            ret.put("success", response == 0);
            call.resolve(ret);
        } catch (RemoteException e) {
            call.reject("consumePurchase ناموفق بود: " + e.getMessage());
        }
    }

    // ==================== Internal helpers ====================

    /** آیا مایکت روی این گوشی نصبه؟ (چه به‌عنوان نصب‌کننده‌ی اپ، چه صرفاً حضور اپ مایکت
     *  رو دستگاه، برای اینکه تست خرید رو نسخه‌ی دیباگ/ساید‌لود هم کار کنه.) */
    private String detectStore() {
        Context ctx = getContext();
        if (ctx == null) return null;
        try {
            String installer;
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                installer = ctx.getPackageManager().getInstallSourceInfo(ctx.getPackageName()).getInstallingPackageName();
            } else {
                installer = ctx.getPackageManager().getInstallerPackageName(ctx.getPackageName());
            }
            Log.d(TAG, "detectStore() installer=" + installer);
            if (MYKET_PACKAGE.equals(installer)) return "myket";
        } catch (Exception e) {
            Log.e(TAG, "detectStore() getInstaller* threw", e);
        }
        boolean myketInstalled = isPackageInstalled(ctx, MYKET_PACKAGE);
        Log.d(TAG, "detectStore() installer wasn't Myket, isPackageInstalled(Myket)=" + myketInstalled);
        if (myketInstalled) return "myket";
        return null;
    }

    private boolean isPackageInstalled(Context ctx, String packageName) {
        try {
            ctx.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (android.content.pm.PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private synchronized boolean ensureBound() {
        if (billingService != null) return true;
        if (boundStore == null) boundStore = detectStore();
        if (boundStore == null) {
            Log.e(TAG, "ensureBound() failing — detectStore() found no Myket install (not the installer, and package not present)");
            return false;
        }

        Context ctx = getContext();
        if (ctx == null) {
            Log.e(TAG, "ensureBound() failing — getContext() returned null");
            return false;
        }

        final CountDownLatch latch = new CountDownLatch(1);
        serviceConnection = new ServiceConnection() {
            @Override
            public void onServiceConnected(ComponentName name, IBinder service) {
                Log.d(TAG, "onServiceConnected — bound to " + name);
                billingService = IInAppBillingService.Stub.asInterface(service);
                latch.countDown();
            }

            @Override
            public void onServiceDisconnected(ComponentName name) {
                Log.d(TAG, "onServiceDisconnected — " + name);
                billingService = null;
            }
        };

        Intent serviceIntent = new Intent(MYKET_BIND_ACTION);
        serviceIntent.setPackage(MYKET_PACKAGE);
        boolean bound;
        try {
            bound = ctx.bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE);
        } catch (Exception e) {
            Log.e(TAG, "ctx.bindService() threw", e);
            bound = false;
        }
        if (!bound) {
            // bindService() returned false synchronously — Android could not even resolve a
            // service matching this action+package. On Android 11+ this usually means the
            // <queries> declaration for ir.mservices.market is missing from the manifest
            // (package-visibility restriction), NOT that Myket itself is misbehaving.
            Log.e(TAG, "ctx.bindService() returned false — no matching service found for action="
                + MYKET_BIND_ACTION + " package=" + MYKET_PACKAGE
                + ". Check the <queries> entry in AndroidManifest.xml.");
            return false;
        }

        try {
            latch.await(BIND_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (InterruptedException ignored) {}
        if (billingService == null) {
            Log.e(TAG, "bindService() accepted the request but onServiceConnected never fired within "
                + BIND_TIMEOUT_MS + "ms — Myket's service accepted the bind but didn't respond in time.");
        }
        return billingService != null;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            if (serviceConnection != null && getContext() != null) {
                getContext().unbindService(serviceConnection);
            }
        } catch (Exception ignored) {}
        billingService = null;
        serviceConnection = null;
    }
}
