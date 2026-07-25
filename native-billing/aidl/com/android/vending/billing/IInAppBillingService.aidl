package com.android.vending.billing;

/**
 * Classic "v3" in-app billing AIDL interface. Myket (ir.mservices.market) publishes a
 * billing service that implements this exact interface under this exact package name —
 * it's a straight clone of Google Play's old Billing v3 AIDL. That's what lets
 * MarketBillingPlugin.java talk to Myket's store app through this code path.
 */
interface IInAppBillingService {
    int isBillingSupported(int apiVersion, String packageName, String type);

    /**
     * @param skusBundle Bundle with a String ArrayList under key "ITEM_ID_LIST"
     * @return Bundle with RESPONSE_CODE and a "DETAILS_LIST" String ArrayList of JSON SKU details
     */
    Bundle getSkuDetails(int apiVersion, String packageName, String type, in Bundle skusBundle);

    /**
     * @return Bundle with RESPONSE_CODE and a "BUY_INTENT" PendingIntent to launch for purchase
     */
    Bundle getBuyIntent(int apiVersion, String packageName, String sku, String type, String developerPayload);

    /**
     * @return Bundle with RESPONSE_CODE, "INAPP_PURCHASE_ITEM_LIST", "INAPP_PURCHASE_DATA_LIST",
     *         "INAPP_DATA_SIGNATURE_LIST" and an optional "INAPP_CONTINUATION_TOKEN"
     */
    Bundle getPurchases(int apiVersion, String packageName, String type, String continuationToken);

    /**
     * @return RESPONSE_CODE (0 on success)
     */
    int consumePurchase(int apiVersion, String packageName, String purchaseToken);
}
