package com.mysmsimageapp;

import android.app.PendingIntent;
import android.content.Intent;
import android.telephony.SmsManager;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.ArrayList;

public class SmsSenderModule extends ReactContextBaseJavaModule {

    private static ReactApplicationContext reactContext;

    public SmsSenderModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @NonNull
    @Override
    public String getName() {
        return "SmsSender";
    }

    @ReactMethod
    public void sendTextMessage(String phoneNumber, String message, Promise promise) {
        try {
            SmsManager sms = SmsManager.getDefault();
            ArrayList<String> parts = sms.divideMessage(message);

            ArrayList<PendingIntent> sentIntents = new ArrayList<>();
            for (int i = 0; i < parts.size(); i++) {
                Intent sentIntent = new Intent("SMS_SENT");
                sentIntents.add(PendingIntent.getBroadcast(reactContext, 0, sentIntent, PendingIntent.FLAG_IMMUTABLE));
            }

            sms.sendMultipartTextMessage(phoneNumber, null, parts, sentIntents, null);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e("SmsSenderModule", "Error sending SMS", e);
            promise.reject("SMS_ERROR", e);
        }
    }

    public static void emitEvent(String eventName, String payload) {
        if (reactContext != null) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, payload);
        }
    }
}
