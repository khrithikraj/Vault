package com.khrithikraj.vault.alarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.khrithikraj.vault.MainActivity;

/**
 * AlarmSnoozeReceiver — Receives snooze requests and reschedules the alarm
 * using AlarmManager.setAlarmClock(). Re-uses ALARM_REQUEST_CODE so any pending
 * alarms are cleanly updated/replaced.
 */
public class AlarmSnoozeReceiver extends BroadcastReceiver {
    public static final String ACTION_SNOOZE = "com.khrithikraj.vault.ACTION_SNOOZE_ALARM";
    public static final String EXTRA_SNOOZE_SECONDS = "snooze_seconds";
    public static final int DEFAULT_SNOOZE_SECONDS = 5 * 60; // 5 minutes

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;

        // Ensure ringing service is stopped if still active
        AlarmService.stopAlarm(context);

        String title = null;
        int snoozeSeconds = DEFAULT_SNOOZE_SECONDS;
        if (intent != null) {
            title = intent.getStringExtra(AlarmActivity.EXTRA_TITLE);
            snoozeSeconds = intent.getIntExtra(EXTRA_SNOOZE_SECONDS, DEFAULT_SNOOZE_SECONDS);
        }
        if (title == null || title.trim().isEmpty()) {
            title = "Vault Alarm (Snoozed)";
        }
        if (snoozeSeconds < 1) {
            snoozeSeconds = DEFAULT_SNOOZE_SECONDS;
        }

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        // On Android 12+ (API 31+), verify exact alarm permission before setting
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!alarmManager.canScheduleExactAlarms()) {
                return;
            }
        }

        String reminderId = null;
        if (intent != null) {
            reminderId = intent.getStringExtra(AlarmActivity.EXTRA_REMINDER_ID);
            if (reminderId == null || reminderId.trim().isEmpty()) {
                reminderId = intent.getStringExtra("reminderId");
            }
        }

        long triggerTimeMillis = System.currentTimeMillis() + (snoozeSeconds * 1000L);

        Intent triggerIntent = new Intent(context, AlarmReceiver.class);
        triggerIntent.setAction(AlarmReceiver.ACTION_TRIGGER);
        triggerIntent.putExtra("title", title);
        if (reminderId != null && !reminderId.trim().isEmpty()) {
            triggerIntent.putExtra("reminderId", reminderId.trim());
        }

        PendingIntent operation = PendingIntent.getBroadcast(
            context,
            VaultAlarmPlugin.ALARM_REQUEST_CODE,
            triggerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent showIntent = new Intent(context, MainActivity.class);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
            context,
            0,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager.AlarmClockInfo clockInfo =
            new AlarmManager.AlarmClockInfo(triggerTimeMillis, showPendingIntent);
        alarmManager.setAlarmClock(clockInfo, operation);
    }
}
