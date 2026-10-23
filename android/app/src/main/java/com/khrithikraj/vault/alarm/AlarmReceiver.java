package com.khrithikraj.vault.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {
    public static final String ACTION_TRIGGER = "com.khrithikraj.vault.ALARM_TRIGGER";

    @Override
    public void onReceive(Context context, Intent intent) {
        String title = intent != null ? intent.getStringExtra("title") : null;
        String reminderId = intent != null ? intent.getStringExtra("reminderId") : null;
        if (title == null || title.trim().isEmpty()) {
            title = "Vault Alarm";
        }

        // Advance recurring alarms to next occurrence; clean up one-time alarms
        if (reminderId != null && !reminderId.trim().isEmpty()) {
            java.util.List<AlarmPreferences.ScheduledAlarm> alarms = AlarmPreferences.getScheduledAlarms(context);
            AlarmPreferences.ScheduledAlarm matched = null;
            for (AlarmPreferences.ScheduledAlarm a : alarms) {
                if (reminderId.equals(a.reminderId)) {
                    matched = a;
                    break;
                }
            }

            if (matched != null && matched.recurrence != null && !matched.recurrence.equalsIgnoreCase("once")) {
                long nextOccurrence = AlarmScheduler.computeNextOccurrenceMillis(
                    matched.localTime,
                    matched.timezone,
                    matched.recurrence,
                    matched.dayOfWeek,
                    System.currentTimeMillis()
                );
                if (nextOccurrence > System.currentTimeMillis()) {
                    AlarmScheduler.schedule(
                        context,
                        matched.reminderId,
                        nextOccurrence,
                        matched.title,
                        matched.recurrence,
                        matched.localTime,
                        matched.timezone,
                        matched.dayOfWeek
                    );
                } else {
                    AlarmPreferences.removeScheduledAlarm(context, reminderId);
                }
            } else {
                AlarmPreferences.removeScheduledAlarm(context, reminderId);
            }
        }

        // 1. Start foreground audio & vibration service
        Intent serviceIntent = new Intent(context, AlarmService.class);
        serviceIntent.putExtra("title", title);
        if (reminderId != null) {
            serviceIntent.putExtra("reminderId", reminderId);
        }
        ContextCompat.startForegroundService(context, serviceIntent);

        // 2. Direct activity launch leveraging AlarmManager.setAlarmClock() BAL exemption
        try {
            Intent activityIntent = new Intent(context, AlarmActivity.class);
            activityIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
            if (reminderId != null) {
                activityIntent.putExtra("reminderId", reminderId);
            }
            activityIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            context.startActivity(activityIntent);
        } catch (Exception e) {
            // If direct start is restricted by OEM policy, fullScreenIntent on notification handles it
            e.printStackTrace();
        }
    }
}
