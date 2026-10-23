package com.khrithikraj.vault.alarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.khrithikraj.vault.MainActivity;
import java.util.Calendar;
import java.util.TimeZone;

/**
 * AlarmScheduler — Centralized manager for native Android alarm clock scheduling.
 */
public final class AlarmScheduler {
    public static final int TEST_ALARM_REQUEST_CODE = 1001;

    private AlarmScheduler() {}

    /**
     * Computes a deterministic positive 31-bit request code from a reminder UUID.
     * Reserves 1001 for test alarms.
     */
    public static int getRequestCode(String reminderId) {
        if (reminderId == null || reminderId.isEmpty()) {
            return TEST_ALARM_REQUEST_CODE;
        }
        int hash = Math.abs(reminderId.hashCode());
        if (hash == TEST_ALARM_REQUEST_CODE) {
            hash = 1002;
        }
        return hash & 0x7FFFFFFF;
    }

    public static boolean canScheduleExactAlarms(Context context) {
        if (context == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                return am != null && am.canScheduleExactAlarms();
            } catch (Exception e) {
                return false;
            }
        }
        return true;
    }

    /**
     * Computes the next occurrence epoch milliseconds for a recurring reminder
     * strictly after afterMillis, honoring the specified IANA timezone.
     */
    public static long computeNextOccurrenceMillis(
        String localTime,
        String timezoneStr,
        String recurrence,
        String dayOfWeekStr,
        long afterMillis
    ) {
        if (localTime == null || localTime.length() < 5) return -1;
        TimeZone tz;
        try {
            tz = (timezoneStr != null && !timezoneStr.trim().isEmpty())
                ? TimeZone.getTimeZone(timezoneStr)
                : TimeZone.getDefault();
        } catch (Exception e) {
            tz = TimeZone.getDefault();
        }

        int hour = Integer.parseInt(localTime.substring(0, 2));
        int minute = Integer.parseInt(localTime.substring(3, 5));

        Calendar cal = Calendar.getInstance(tz);
        cal.setTimeInMillis(afterMillis);
        cal.set(Calendar.HOUR_OF_DAY, hour);
        cal.set(Calendar.MINUTE, minute);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        if ("once".equalsIgnoreCase(recurrence)) {
            return cal.getTimeInMillis() > afterMillis ? cal.getTimeInMillis() : -1;
        }

        if ("daily".equalsIgnoreCase(recurrence)) {
            if (cal.getTimeInMillis() <= afterMillis) {
                cal.add(Calendar.DAY_OF_YEAR, 1);
            }
            return cal.getTimeInMillis();
        }

        if ("weekdays".equalsIgnoreCase(recurrence)) {
            for (int i = 0; i < 14; i++) {
                int dow = cal.get(Calendar.DAY_OF_WEEK);
                boolean isWeekday = (dow >= Calendar.MONDAY && dow <= Calendar.FRIDAY);
                if (isWeekday && cal.getTimeInMillis() > afterMillis) {
                    return cal.getTimeInMillis();
                }
                cal.add(Calendar.DAY_OF_YEAR, 1);
            }
            return cal.getTimeInMillis();
        }

        if ("weekly".equalsIgnoreCase(recurrence)) {
            int targetCalendarDow = -1;
            if (dayOfWeekStr != null && !dayOfWeekStr.trim().isEmpty()) {
                switch (dayOfWeekStr.trim().toLowerCase()) {
                    case "sunday": targetCalendarDow = Calendar.SUNDAY; break;
                    case "monday": targetCalendarDow = Calendar.MONDAY; break;
                    case "tuesday": targetCalendarDow = Calendar.TUESDAY; break;
                    case "wednesday": targetCalendarDow = Calendar.WEDNESDAY; break;
                    case "thursday": targetCalendarDow = Calendar.THURSDAY; break;
                    case "friday": targetCalendarDow = Calendar.FRIDAY; break;
                    case "saturday": targetCalendarDow = Calendar.SATURDAY; break;
                    default: targetCalendarDow = -1; break;
                }
            }
            if (targetCalendarDow == -1) {
                Calendar currentCal = Calendar.getInstance(tz);
                currentCal.setTimeInMillis(afterMillis);
                targetCalendarDow = currentCal.get(Calendar.DAY_OF_WEEK);
            }

            for (int i = 0; i < 14; i++) {
                if (cal.get(Calendar.DAY_OF_WEEK) == targetCalendarDow && cal.getTimeInMillis() > afterMillis) {
                    return cal.getTimeInMillis();
                }
                cal.add(Calendar.DAY_OF_YEAR, 1);
            }
            return cal.getTimeInMillis();
        }

        // Fallback: daily
        if (cal.getTimeInMillis() <= afterMillis) {
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }
        return cal.getTimeInMillis();
    }

    /**
     * Schedules an exact alarm using AlarmManager.setAlarmClock() and persists metadata.
     */
    public static boolean schedule(
        Context context,
        String reminderId,
        long triggerTimeMillis,
        String title,
        String recurrence,
        String localTime,
        String timezone,
        String dayOfWeek
    ) {
        if (context == null || triggerTimeMillis <= System.currentTimeMillis()) {
            return false;
        }
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null || !canScheduleExactAlarms(context)) {
                return false;
            }

            int requestCode = getRequestCode(reminderId);

            Intent triggerIntent = new Intent(context, AlarmReceiver.class);
            triggerIntent.setAction(AlarmReceiver.ACTION_TRIGGER);
            triggerIntent.putExtra("title", title);
            if (reminderId != null) {
                triggerIntent.putExtra("reminderId", reminderId);
            }

            PendingIntent operation = PendingIntent.getBroadcast(
                context,
                requestCode,
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

            if (reminderId != null) {
                AlarmPreferences.saveScheduledAlarm(
                    context,
                    reminderId,
                    triggerTimeMillis,
                    title,
                    recurrence,
                    localTime,
                    timezone,
                    dayOfWeek
                );
            }
            return true;
        } catch (Exception e) {
            android.util.Log.e("AlarmScheduler", "Failed to schedule alarm: " + reminderId, e);
            return false;
        }
    }

    public static boolean schedule(Context context, String reminderId, long triggerTimeMillis, String title) {
        return schedule(context, reminderId, triggerTimeMillis, title, "once", null, null, null);
    }

    /**
     * Cancels any pending AlarmManager alarm for the given reminderId and removes it from preferences.
     */
    public static boolean cancel(Context context, String reminderId) {
        if (context == null) return false;
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            int requestCode = getRequestCode(reminderId);

            Intent triggerIntent = new Intent(context, AlarmReceiver.class);
            triggerIntent.setAction(AlarmReceiver.ACTION_TRIGGER);
            PendingIntent operation = PendingIntent.getBroadcast(
                context,
                requestCode,
                triggerIntent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );

            if (alarmManager != null && operation != null) {
                alarmManager.cancel(operation);
                operation.cancel();
            }

            if (reminderId != null) {
                AlarmPreferences.removeScheduledAlarm(context, reminderId);
            }
            return true;
        } catch (Exception e) {
            android.util.Log.e("AlarmScheduler", "Failed to cancel alarm: " + reminderId, e);
            return false;
        }
    }
}
