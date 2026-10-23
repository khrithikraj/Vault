package com.khrithikraj.vault.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AlarmDismissReceiver extends BroadcastReceiver {
    public static final String ACTION_DISMISS = "com.khrithikraj.vault.ACTION_DISMISS_ALARM";
    public static final String ACTION_VIEW_VAULT = "com.khrithikraj.vault.ACTION_VIEW_VAULT";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        AlarmService.stopAlarm(context);

        if (intent != null && ACTION_VIEW_VAULT.equals(intent.getAction())) {
            Intent mainIntent = new Intent(context, com.khrithikraj.vault.MainActivity.class);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(mainIntent);
        }
    }
}
