package com.mysmsimageapp;

import android.telephony.SmsManager;
import android.util.Log;
import com.facebook.react.bridge.*;

public class SmsSender extends ReactContextBaseJavaModule {

    public SmsSender(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SmsSender";
    }

    @ReactMethod
    public void sendTextChunks(String phoneNumber, ReadableArray chunks, String messageId, Promise promise) {
        try {
            SmsManager smsManager = SmsManager.getDefault();

            for (int i = 0; i < chunks.size(); i++) {
                String chunk = chunks.getString(i);
                // Prefix: messageId|index|totalChunks|chunk
                String text = messageId + "|" + i + "|" + chunks.size() + "|" + chunk;
                smsManager.sendTextMessage(phoneNumber, null, text, null, null);
            }

            promise.resolve(true);
        } catch (Exception e) {
            Log.e("SmsSender", "Failed to send SMS chunks", e);
            promise.reject("SMS_ERROR", e);
        }
    }
}
