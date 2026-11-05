package com.khrithikraj.vault.alarm;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.File;

/**
 * AlarmPreferences — Persists alarm configuration and cached audio on-device.
 */
public final class AlarmPreferences {
    private static final String PREFS_NAME = "vault_alarm_prefs";
    private static final String KEY_RINGTONE_URI = "alarm_ringtone_uri";
    private static final String KEY_RINGTONE_TITLE = "alarm_ringtone_title";
    public static final String CACHED_TONE_FILENAME = "custom_alarm_tone.dat";

    private AlarmPreferences() {}

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static File getCustomToneFile(Context context) {
        return new File(context.getFilesDir(), CACHED_TONE_FILENAME);
    }

    public static boolean hasCustomTone(Context context) {
        File file = getCustomToneFile(context);
        return file.exists() && file.length() > 0;
    }

    public static void setRingtone(Context context, String uriString, String title) {
        if (context == null) return;
        getPrefs(context)
            .edit()
            .putString(KEY_RINGTONE_URI, uriString)
            .putString(KEY_RINGTONE_TITLE, title)
            .apply();
    }

    public static String getRingtoneUri(Context context) {
        if (context == null) return null;
        return getPrefs(context).getString(KEY_RINGTONE_URI, null);
    }

    public static String getRingtoneTitle(Context context) {
        if (context == null) return null;
        return getPrefs(context).getString(KEY_RINGTONE_TITLE, null);
    }

    public static void resetRingtone(Context context) {
        if (context == null) return;
        try {
            File file = getCustomToneFile(context);
            if (file.exists()) {
                file.delete();
            }
        } catch (Exception ignored) {}

        getPrefs(context)
            .edit()
            .remove(KEY_RINGTONE_URI)
            .remove(KEY_RINGTONE_TITLE)
            .apply();
    }

    public static class ScheduledAlarm {
        public final String reminderId;
        public final long triggerTimeMillis;
        public final String triggerId;
        public final String title;
        public final String recurrence;
        public final String localTime;
        public final String timezone;
        public final String dayOfWeek;

        public ScheduledAlarm(String reminderId, long triggerTimeMillis, String title) {
            this(reminderId, triggerTimeMillis, title, "once", null, null, null, null);
        }

        public ScheduledAlarm(
            String reminderId,
            long triggerTimeMillis,
            String title,
            String recurrence,
            String localTime,
            String timezone,
            String dayOfWeek,
            String triggerId
        ) {
            this.reminderId = reminderId;
            this.triggerTimeMillis = triggerTimeMillis;
            this.triggerId = triggerId;
            this.title = title;
            this.recurrence = recurrence != null ? recurrence : "once";
            this.localTime = localTime;
            this.timezone = timezone;
            this.dayOfWeek = dayOfWeek;
        }
    }

    private static final String KEY_SCHEDULED_ALARMS = "scheduled_alarms_map";
    private static final String KEY_ACTIVE_ALARM = "active_alarm";

    public static final class ActiveAlarm {
        public final String reminderId;
        public final String triggerId;
        public final String title;

        public ActiveAlarm(String reminderId, String triggerId, String title) {
            this.reminderId = reminderId;
            this.triggerId = triggerId;
            this.title = title;
        }
    }

    public static synchronized boolean claimActiveAlarm(
        Context context,
        String reminderId,
        String triggerId,
        String title
    ) {
        if (context == null || triggerId == null || triggerId.trim().isEmpty()) return false;
        ActiveAlarm active = getActiveAlarm(context);
        if (active != null && triggerId.equals(active.triggerId)) return false;
        try {
            org.json.JSONObject item = new org.json.JSONObject();
            item.put("reminderId", reminderId);
            item.put("triggerId", triggerId);
            item.put("title", title != null ? title : "Vault Alarm");
            getPrefs(context).edit()
                .putString(KEY_ACTIVE_ALARM, item.toString())
                .apply();
            return true;
        } catch (Exception e) {
            android.util.Log.e("AlarmPreferences", "Failed to claim active alarm: " + triggerId, e);
            return false;
        }
    }

    public static synchronized ActiveAlarm getActiveAlarm(Context context) {
        if (context == null) return null;
        try {
            String raw = getPrefs(context).getString(KEY_ACTIVE_ALARM, null);
            if (raw == null || raw.trim().isEmpty()) return null;
            org.json.JSONObject item = new org.json.JSONObject(raw);
            return new ActiveAlarm(
                item.optString("reminderId", null),
                item.getString("triggerId"),
                item.optString("title", "Vault Alarm")
            );
        } catch (Exception e) {
            android.util.Log.e("AlarmPreferences", "Failed to read active alarm", e);
            return null;
        }
    }

    public static synchronized boolean clearActiveAlarm(Context context, String triggerId) {
        if (context == null) return false;
        ActiveAlarm active = getActiveAlarm(context);
        if (active == null) return false;
        if (triggerId != null && !triggerId.equals(active.triggerId)) return false;
        getPrefs(context).edit().remove(KEY_ACTIVE_ALARM).apply();
        return true;
    }

    public static synchronized boolean isCurrentTrigger(
        Context context,
        String reminderId,
        String triggerId
    ) {
        if (context == null || reminderId == null || triggerId == null) return false;
        for (ScheduledAlarm alarm : getScheduledAlarms(context)) {
            if (reminderId.equals(alarm.reminderId) && triggerId.equals(alarm.triggerId)) {
                return true;
            }
        }
        return false;
    }

    public static synchronized void saveScheduledAlarm(
        Context context,
        String reminderId,
        long triggerTimeMillis,
        String title,
        String recurrence,
        String localTime,
        String timezone,
        String dayOfWeek
    ) {
        if (context == null || reminderId == null) return;
        try {
            SharedPreferences prefs = getPrefs(context);
            String raw = prefs.getString(KEY_SCHEDULED_ALARMS, "{}");
            org.json.JSONObject root = new org.json.JSONObject(raw);
            org.json.JSONObject item = new org.json.JSONObject();
            item.put("reminderId", reminderId);
            item.put("triggerTimeMillis", triggerTimeMillis);
            item.put("triggerId", AlarmScheduler.buildTriggerId(reminderId, triggerTimeMillis));
            item.put("title", title != null ? title : "Vault Reminder");
            item.put("recurrence", recurrence != null ? recurrence : "once");
            if (localTime != null) item.put("localTime", localTime);
            if (timezone != null) item.put("timezone", timezone);
            if (dayOfWeek != null) item.put("dayOfWeek", dayOfWeek);
            root.put(reminderId, item);
            prefs.edit().putString(KEY_SCHEDULED_ALARMS, root.toString()).apply();
        } catch (Exception e) {
            android.util.Log.e("AlarmPreferences", "Failed to save scheduled alarm: " + reminderId, e);
        }
    }

    public static synchronized void saveScheduledAlarm(Context context, String reminderId, long triggerTimeMillis, String title) {
        saveScheduledAlarm(context, reminderId, triggerTimeMillis, title, "once", null, null, null);
    }

    public static synchronized void removeScheduledAlarm(Context context, String reminderId) {
        if (context == null || reminderId == null) return;
        try {
            SharedPreferences prefs = getPrefs(context);
            String raw = prefs.getString(KEY_SCHEDULED_ALARMS, "{}");
            org.json.JSONObject root = new org.json.JSONObject(raw);
            if (root.has(reminderId)) {
                root.remove(reminderId);
                prefs.edit().putString(KEY_SCHEDULED_ALARMS, root.toString()).apply();
            }
        } catch (Exception e) {
            android.util.Log.e("AlarmPreferences", "Failed to remove scheduled alarm: " + reminderId, e);
        }
    }

    public static synchronized java.util.List<ScheduledAlarm> getScheduledAlarms(Context context) {
        java.util.List<ScheduledAlarm> list = new java.util.ArrayList<>();
        if (context == null) return list;
        try {
            SharedPreferences prefs = getPrefs(context);
            String raw = prefs.getString(KEY_SCHEDULED_ALARMS, "{}");
            org.json.JSONObject root = new org.json.JSONObject(raw);
            java.util.Iterator<String> keys = root.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                org.json.JSONObject item = root.getJSONObject(key);
                list.add(new ScheduledAlarm(
                    item.getString("reminderId"),
                    item.getLong("triggerTimeMillis"),
                    item.optString("title", "Vault Reminder"),
                    item.optString("recurrence", "once"),
                    item.optString("localTime", null),
                    item.optString("timezone", null),
                    item.optString("dayOfWeek", null),
                    item.optString(
                        "triggerId",
                        AlarmScheduler.buildTriggerId(
                            item.getString("reminderId"),
                            item.getLong("triggerTimeMillis")
                        )
                    )
                ));
            }
        } catch (Exception e) {
            android.util.Log.e("AlarmPreferences", "Failed to get scheduled alarms", e);
        }
        return list;
    }
}
