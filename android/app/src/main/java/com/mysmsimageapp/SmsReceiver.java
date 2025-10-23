package com.mysmsimageapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import org.json.JSONObject;

public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null) return;

        for (Object pdu : pdus) {
            SmsMessage msg = SmsMessage.createFromPdu((byte[]) pdu);
            String from = msg.getOriginatingAddress();
            String text = msg.getMessageBody();

            try {
                JSONObject payload = new JSONObject();
                payload.put("from", from);
                payload.put("text", text);
                SmsSenderModule.emitEvent("SMS_IMG_RECEIVED", payload.toString());
            } catch (Exception e) {
                Log.e("SmsReceiver", "Failed to parse SMS", e);
            }
        }
    }
}
