package com.khrithikraj.vault.alarm;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.khrithikraj.vault.MainActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * VaultAlarmPlugin — Capacitor bridge for native Android alarm scheduling.
 *
 * NOTE: This plugin intentionally does NOT override checkPermissions() from Plugin.
 * Capacitor's base Plugin class declares @PluginMethod checkPermissions(), and overriding it
 * causes a method-name collision in PluginHandle.indexMethods() (which uses getMethods() +
 * a HashMap keyed by name). The collision means Capacitor's exception path gets hit and
 * the JS Promise hangs forever without resolving or rejecting.
 *
 * Instead we expose getAlarmPermissions() for our custom permission state, and the
 * alarmBridge.ts TypeScript layer maps window.VaultAlarm.checkPermissions() to this method.
 */
@CapacitorPlugin(
    name = "VaultAlarm",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class VaultAlarmPlugin extends Plugin {
    public static final int ALARM_REQUEST_CODE = 1001;
    private static String pendingLaunchReminderId = null;

    public static synchronized void setLaunchReminderId(String id) {
        pendingLaunchReminderId = id;
    }

    // ─── Private helpers ────────────────────────────────────────────────────

    private boolean hasExactAlarmPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                AlarmManager alarmManager =
                    (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                return alarmManager != null && alarmManager.canScheduleExactAlarms();
            } catch (Exception e) {
                return false;
            }
        }
        return true;
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private boolean hasFullScreenIntentPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                NotificationManager nm =
                    (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                return nm != null && nm.canUseFullScreenIntent();
            } catch (Exception e) {
                return false;
            }
        }
        return true;
    }

    // ─── Plugin methods ──────────────────────────────────────────────────────

    /**
     * Returns the current state of exact-alarm, notification, and full-screen intent permissions.
     *
     * Intentionally named getAlarmPermissions (not checkPermissions) to avoid
     * colliding with Plugin.checkPermissions() in Capacitor's method index.
     * The JS bridge in alarmBridge.ts exposes this as checkPermissions().
     */
    @PluginMethod
    public void getAlarmPermissions(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("exactAlarmGranted", hasExactAlarmPermission());
            ret.put("notificationsGranted", hasNotificationPermission());
            ret.put("fullScreenIntentGranted", hasFullScreenIntentPermission());
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("getAlarmPermissions failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                ret.put("opened", true);
            } else {
                ret.put("opened", false);
            }
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("openFullScreenIntentSettings failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager alarmManager =
                    (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    ret.put("opened", true);
                    ret.put("alreadyGranted", false);
                    call.resolve(ret);
                    return;
                }
            }
            ret.put("opened", false);
            ret.put("alreadyGranted", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("requestExactAlarmPermission failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (!hasNotificationPermission()) {
                    requestPermissionForAlias("notifications", call, "notificationPermCallback");
                    return;
                }
            }
            JSObject ret = new JSObject();
            ret.put("notifications", "granted");
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("requestNotificationPermission failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PermissionCallback
    private void notificationPermCallback(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("notifications", hasNotificationPermission() ? "granted" : "denied");
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("notificationPermCallback failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void scheduleTestAlarm(PluginCall call) {
        try {
            Integer secondsParam = call.getInt("secondsFromNow");
            int secondsFromNow = secondsParam != null ? secondsParam : 10;
            if (secondsFromNow < 1) {
                secondsFromNow = 1;
            }
            String title = call.getString("title", "Vault Test Alarm");

            if (!hasExactAlarmPermission()) {
                call.reject(
                    "Exact alarm permission is required. Use requestExactAlarmPermission() to open settings.",
                    "PERMISSION_DENIED",
                    null,
                    null
                );
                return;
            }

            AlarmManager alarmManager =
                (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                call.reject("AlarmManager service is unavailable.", "UNAVAILABLE", null, null);
                return;
            }

            long triggerTimeMillis = System.currentTimeMillis() + (secondsFromNow * 1000L);

            Intent triggerIntent = new Intent(getContext(), AlarmReceiver.class);
            triggerIntent.setAction(AlarmReceiver.ACTION_TRIGGER);
            triggerIntent.putExtra("title", title);
            PendingIntent operation = PendingIntent.getBroadcast(
                getContext(),
                ALARM_REQUEST_CODE,
                triggerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Intent showIntent = new Intent(getContext(), MainActivity.class);
            PendingIntent showPendingIntent = PendingIntent.getActivity(
                getContext(),
                0,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            AlarmManager.AlarmClockInfo clockInfo =
                new AlarmManager.AlarmClockInfo(triggerTimeMillis, showPendingIntent);
            alarmManager.setAlarmClock(clockInfo, operation);

            JSObject ret = new JSObject();
            ret.put("scheduled", true);
            ret.put("triggerTimeMillis", triggerTimeMillis);
            ret.put("secondsFromNow", secondsFromNow);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("scheduleTestAlarm failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        try {
            AlarmManager alarmManager =
                (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                Intent triggerIntent = new Intent(getContext(), AlarmReceiver.class);
                triggerIntent.setAction(AlarmReceiver.ACTION_TRIGGER);
                PendingIntent operation = PendingIntent.getBroadcast(
                    getContext(),
                    ALARM_REQUEST_CODE,
                    triggerIntent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                if (operation != null) {
                    alarmManager.cancel(operation);
                    operation.cancel();
                }
            }
            AlarmService.stopAlarm(getContext());

            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("cancelAlarm failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        try {
            String reminderId = call.getString("reminderId");
            if (reminderId == null || reminderId.trim().isEmpty()) {
                call.reject("reminderId is required", "INVALID_ARGUMENT", null, null);
                return;
            }
            Long triggerTimeMillis = null;
            Object rawTrigger = call.getData() != null ? call.getData().opt("triggerTimeMillis") : null;
            if (rawTrigger instanceof Number) {
                triggerTimeMillis = ((Number) rawTrigger).longValue();
            } else if (rawTrigger instanceof String) {
                try {
                    triggerTimeMillis = Long.parseLong(((String) rawTrigger).trim());
                } catch (NumberFormatException ignored) {}
            }

            if (triggerTimeMillis == null || triggerTimeMillis <= 0) {
                call.reject("triggerTimeMillis is required and must be positive", "INVALID_ARGUMENT", null, null);
                return;
            }
            if (triggerTimeMillis <= System.currentTimeMillis()) {
                call.reject("triggerTimeMillis must be in the future", "INVALID_ARGUMENT", null, null);
                return;
            }
            String title = call.getString("title", "Vault Reminder");

            if (!hasExactAlarmPermission()) {
                call.reject(
                    "Exact alarm permission is required. Use requestExactAlarmPermission() to open settings.",
                    "PERMISSION_DENIED",
                    null,
                    null
                );
                return;
            }

            String recurrence = call.getString("recurrence", "once");
            String localTime = call.getString("localTime");
            String timezone = call.getString("timezone");
            String dayOfWeek = call.getString("dayOfWeek");

            boolean success = AlarmScheduler.schedule(
                getContext(),
                reminderId,
                triggerTimeMillis,
                title,
                recurrence,
                localTime,
                timezone,
                dayOfWeek
            );
            if (!success) {
                call.reject("Failed to schedule alarm with AlarmManager", "SCHEDULE_FAILED", null, null);
                return;
            }

            JSObject ret = new JSObject();
            ret.put("scheduled", true);
            ret.put("reminderId", reminderId);
            ret.put("triggerTimeMillis", triggerTimeMillis);
            ret.put("title", title);
            ret.put("recurrence", recurrence);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("scheduleAlarm failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void cancelAlarmById(PluginCall call) {
        try {
            String reminderId = call.getString("reminderId");
            if (reminderId == null || reminderId.trim().isEmpty()) {
                call.reject("reminderId is required", "INVALID_ARGUMENT", null, null);
                return;
            }

            boolean cancelled = AlarmScheduler.cancel(getContext(), reminderId);
            JSObject ret = new JSObject();
            ret.put("cancelled", cancelled);
            ret.put("reminderId", reminderId);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("cancelAlarmById failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void getScheduledAlarms(PluginCall call) {
        try {
            java.util.List<AlarmPreferences.ScheduledAlarm> list =
                AlarmPreferences.getScheduledAlarms(getContext());
            com.getcapacitor.JSArray array = new com.getcapacitor.JSArray();
            long now = System.currentTimeMillis();
            for (AlarmPreferences.ScheduledAlarm item : list) {
                JSObject obj = new JSObject();
                obj.put("reminderId", item.reminderId);
                obj.put("triggerTimeMillis", item.triggerTimeMillis);
                obj.put("title", item.title);
                obj.put("recurrence", item.recurrence != null ? item.recurrence : "once");
                if (item.localTime != null) obj.put("localTime", item.localTime);
                if (item.timezone != null) obj.put("timezone", item.timezone);
                if (item.dayOfWeek != null) obj.put("dayOfWeek", item.dayOfWeek);
                obj.put("isPast", item.triggerTimeMillis <= now);
                array.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("alarms", array);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("getScheduledAlarms failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void getLaunchReminder(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("reminderId", pendingLaunchReminderId);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("getLaunchReminder failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void clearLaunchReminder(PluginCall call) {
        try {
            pendingLaunchReminderId = null;
            JSObject ret = new JSObject();
            ret.put("cleared", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("clearLaunchReminder failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void isRinging(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("isRinging", AlarmService.isRinging());
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("isRinging failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void snoozeAlarm(PluginCall call) {
        try {
            Integer secondsParam = call.getInt("seconds");
            int snoozeSeconds = (secondsParam != null && secondsParam > 0)
                ? secondsParam
                : AlarmActivity.SNOOZE_SECONDS;
            String title = call.getString("title", "Vault Alarm (Snoozed)");

            AlarmService.stopAlarm(getContext());

            Intent snoozeIntent = new Intent(getContext(), AlarmSnoozeReceiver.class);
            snoozeIntent.setAction(AlarmSnoozeReceiver.ACTION_SNOOZE);
            snoozeIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
            snoozeIntent.putExtra(AlarmSnoozeReceiver.EXTRA_SNOOZE_SECONDS, snoozeSeconds);
            getContext().sendBroadcast(snoozeIntent);

            JSObject ret = new JSObject();
            ret.put("snoozed", true);
            ret.put("snoozeSeconds", snoozeSeconds);
            ret.put("triggerTimeMillis", System.currentTimeMillis() + (snoozeSeconds * 1000L));
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("snoozeAlarm failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void selectRingtone(PluginCall call) {
        try {
            Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM);
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Select Vault Alarm Tone");
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);

            String currentUriStr = AlarmPreferences.getRingtoneUri(getContext());
            if (currentUriStr != null && !currentUriStr.trim().isEmpty()) {
                intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(currentUriStr));
            } else {
                intent.putExtra(
                    RingtoneManager.EXTRA_RINGTONE_EXISTING_URI,
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                );
            }

            startActivityForResult(call, intent, "ringtonePickerResult");
        } catch (Throwable t) {
            call.reject("selectRingtone failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    private MediaPlayer previewPlayer;

    private String resolveRingtoneTitle(Uri uri) {
        if (uri == null) return "Default Alarm Tone";
        String title = null;
        try {
            Cursor cursor = getContext().getContentResolver().query(
                uri,
                new String[] {
                    MediaStore.Audio.Media.TITLE,
                    OpenableColumns.DISPLAY_NAME
                },
                null, null, null
            );
            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    int titleIdx = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                    if (titleIdx != -1) {
                        String t = cursor.getString(titleIdx);
                        if (t != null && !t.trim().isEmpty() && !t.matches("^\\d+$")) {
                            title = t.trim();
                        }
                    }
                    if (title == null) {
                        int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (nameIdx != -1) {
                            String name = cursor.getString(nameIdx);
                            if (name != null && !name.trim().isEmpty()) {
                                if (name.contains(".")) {
                                    name = name.substring(0, name.lastIndexOf('.'));
                                }
                                if (!name.matches("^\\d+$")) {
                                    title = name.trim();
                                }
                            }
                        }
                    }
                }
                cursor.close();
            }
        } catch (Exception ignored) {}

        if (title == null || title.trim().isEmpty() || title.matches("^\\d+$")) {
            try {
                Ringtone ringtone = RingtoneManager.getRingtone(getContext(), uri);
                if (ringtone != null) {
                    String rTitle = ringtone.getTitle(getContext());
                    if (rTitle != null && !rTitle.trim().isEmpty() && !rTitle.matches("^\\d+$")) {
                        title = rTitle.trim();
                    }
                }
            } catch (Exception ignored) {}
        }

        if (title == null || title.trim().isEmpty() || title.matches("^\\d+$")) {
            title = "Custom Alarm Tone";
        }
        return title;
    }

    private void stopCurrentPreview() {
        if (previewPlayer != null) {
            try {
                if (previewPlayer.isPlaying()) {
                    previewPlayer.stop();
                }
                previewPlayer.release();
            } catch (Exception ignored) {}
            previewPlayer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopCurrentPreview();
        super.handleOnDestroy();
    }

    @ActivityCallback
    private void ringtonePickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                Uri uri = result.getData().getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
                JSObject ret = new JSObject();
                if (uri != null) {
                    String title = resolveRingtoneTitle(uri);
                    boolean cacheSuccess = false;

                    // Copy the audio stream to app-internal storage while active URI permission grant is valid
                    try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                         OutputStream out = new FileOutputStream(AlarmPreferences.getCustomToneFile(getContext()))) {
                        if (in != null) {
                            byte[] buffer = new byte[8192];
                            int read;
                            while ((read = in.read(buffer)) != -1) {
                                out.write(buffer, 0, read);
                            }
                            cacheSuccess = true;
                        }
                    } catch (Exception copyEx) {
                        android.util.Log.e("VaultAlarm", "Failed to cache picked ringtone audio: " + copyEx.getMessage(), copyEx);
                    }

                    if (cacheSuccess) {
                        AlarmPreferences.setRingtone(getContext(), uri.toString(), title);
                        ret.put("selected", true);
                        ret.put("uri", uri.toString());
                        ret.put("title", title);
                        ret.put("isDefault", false);
                    } else {
                        // If stream could not be cached, fall back gracefully to default tone
                        AlarmPreferences.resetRingtone(getContext());
                        ret.put("selected", false);
                        ret.put("uri", null);
                        ret.put("title", "Default Alarm Tone");
                        ret.put("isDefault", true);
                        ret.put("error", "Unable to read audio stream from selected tone.");
                    }
                } else {
                    // Selected default tone in picker
                    AlarmPreferences.resetRingtone(getContext());
                    Ringtone defaultRingtone = RingtoneManager.getRingtone(
                        getContext(),
                        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    );
                    String defaultTitle = defaultRingtone != null ? defaultRingtone.getTitle(getContext()) : "Default Alarm Tone";
                    ret.put("selected", true);
                    ret.put("uri", null);
                    ret.put("title", defaultTitle);
                    ret.put("isDefault", true);
                }
                call.resolve(ret);
            } else {
                // Cancelled without change
                JSObject ret = new JSObject();
                ret.put("selected", false);
                ret.put("uri", AlarmPreferences.getRingtoneUri(getContext()));
                ret.put("title", AlarmPreferences.getRingtoneTitle(getContext()));
                ret.put("isDefault", !AlarmPreferences.hasCustomTone(getContext()));
                call.resolve(ret);
            }
        } catch (Throwable t) {
            call.reject("ringtonePickerResult failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void getRingtone(PluginCall call) {
        try {
            String uriStr = AlarmPreferences.getRingtoneUri(getContext());
            String title = AlarmPreferences.getRingtoneTitle(getContext());
            boolean isDefault = !AlarmPreferences.hasCustomTone(getContext());
            if (title == null || title.trim().isEmpty() || isDefault) {
                Ringtone defaultRingtone = RingtoneManager.getRingtone(
                    getContext(),
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                );
                title = defaultRingtone != null ? defaultRingtone.getTitle(getContext()) : "Default Alarm Tone";
            }
            JSObject ret = new JSObject();
            ret.put("uri", uriStr);
            ret.put("title", title);
            ret.put("isDefault", isDefault);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("getRingtone failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void resetRingtone(PluginCall call) {
        try {
            stopCurrentPreview();
            AlarmPreferences.resetRingtone(getContext());
            Ringtone defaultRingtone = RingtoneManager.getRingtone(
                getContext(),
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            );
            String title = defaultRingtone != null ? defaultRingtone.getTitle(getContext()) : "Default Alarm Tone";
            JSObject ret = new JSObject();
            ret.put("reset", true);
            ret.put("uri", null);
            ret.put("title", title);
            ret.put("isDefault", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("resetRingtone failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void previewRingtone(PluginCall call) {
        try {
            stopCurrentPreview();

            previewPlayer = new MediaPlayer();
            String title = AlarmPreferences.getRingtoneTitle(getContext());
            boolean isCustom = AlarmPreferences.hasCustomTone(getContext());

            if (isCustom) {
                File customFile = AlarmPreferences.getCustomToneFile(getContext());
                previewPlayer.setDataSource(customFile.getAbsolutePath());
            } else {
                Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }
                previewPlayer.setDataSource(getContext(), alarmUri);
                if (title == null) {
                    Ringtone r = RingtoneManager.getRingtone(getContext(), alarmUri);
                    title = r != null ? r.getTitle(getContext()) : "Default Alarm Tone";
                }
            }

            previewPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            previewPlayer.setLooping(false);
            previewPlayer.setOnCompletionListener(mp -> stopCurrentPreview());
            previewPlayer.prepare();
            previewPlayer.start();

            JSObject ret = new JSObject();
            ret.put("playing", true);
            ret.put("title", title != null ? title : "Alarm Tone");
            call.resolve(ret);
        } catch (Throwable t) {
            stopCurrentPreview();
            call.reject("previewRingtone failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }

    @PluginMethod
    public void stopRingtonePreview(PluginCall call) {
        try {
            stopCurrentPreview();
            JSObject ret = new JSObject();
            ret.put("stopped", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("stopRingtonePreview failed: " + t.getMessage(), t.getClass().getSimpleName(), null, null);
        }
    }
}
