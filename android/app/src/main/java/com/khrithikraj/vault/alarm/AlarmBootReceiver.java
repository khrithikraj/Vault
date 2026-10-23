package com.khrithikraj.vault.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import java.util.List;

/**
 * AlarmBootReceiver — Restores active alarms upon device restart.
 */
public class AlarmBootReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Log.d(TAG, "Device boot completed, restoring scheduled alarms...");

            try {
                List<AlarmPreferences.ScheduledAlarm> alarms = AlarmPreferences.getScheduledAlarms(context);
                long now = System.currentTimeMillis();
                for (AlarmPreferences.ScheduledAlarm alarm : alarms) {
                    if (alarm.triggerTimeMillis > now) {
                        Log.d(TAG, "Rescheduling alarm for reminder: " + alarm.reminderId + " at " + alarm.triggerTimeMillis);
                        AlarmScheduler.schedule(
                            context,
                            alarm.reminderId,
                            alarm.triggerTimeMillis,
                            alarm.title,
                            alarm.recurrence,
                            alarm.localTime,
                            alarm.timezone,
                            alarm.dayOfWeek
                        );
                    } else if (alarm.recurrence != null && !alarm.recurrence.equalsIgnoreCase("once")) {
                        long nextOccurrence = AlarmScheduler.computeNextOccurrenceMillis(
                            alarm.localTime,
                            alarm.timezone,
                            alarm.recurrence,
                            alarm.dayOfWeek,
                            now
                        );
                        if (nextOccurrence > now) {
                            Log.d(TAG, "Rescheduling recurring alarm for reminder: " + alarm.reminderId + " at " + nextOccurrence);
                            AlarmScheduler.schedule(
                                context,
                                alarm.reminderId,
                                nextOccurrence,
                                alarm.title,
                                alarm.recurrence,
                                alarm.localTime,
                                alarm.timezone,
                                alarm.dayOfWeek
                            );
                        } else {
                            Log.d(TAG, "Removing unresolvable recurring alarm for reminder: " + alarm.reminderId);
                            AlarmPreferences.removeScheduledAlarm(context, alarm.reminderId);
                        }
                    } else {
                        Log.d(TAG, "Removing expired alarm for reminder: " + alarm.reminderId);
                        AlarmPreferences.removeScheduledAlarm(context, alarm.reminderId);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error restoring alarms on boot", e);
            }
        }
    }
}
