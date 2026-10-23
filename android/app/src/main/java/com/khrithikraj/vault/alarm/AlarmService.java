package com.khrithikraj.vault.alarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import com.khrithikraj.vault.MainActivity;
import java.io.File;

public class AlarmService extends Service {
    public static final String CHANNEL_ID = "vault_alarm_channel";
    public static final int NOTIFICATION_ID = 2001;

    private static volatile boolean ringing = false;

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    public static boolean isRinging() {
        return ringing;
    }

    public static void stopAlarm(Context context) {
        Intent stopIntent = new Intent(context, AlarmService.class);
        context.stopService(stopIntent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent != null ? intent.getStringExtra("title") : null;
        String reminderId = intent != null ? intent.getStringExtra("reminderId") : null;
        if (title == null || title.trim().isEmpty()) {
            title = "Vault Test Alarm";
        }

        acquireWakeLock();
        startForegroundWithNotification(title, reminderId);
        startAlarmAudioAndVibration();
        ringing = true;

        return START_NOT_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Vault Alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Audio alarms for Vault reminders");
            channel.enableVibration(true);
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setSound(null, null); // Handled by MediaPlayer for looping control

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startForegroundWithNotification(String title, String reminderId) {
        Intent dismissIntent = new Intent(this, AlarmDismissReceiver.class);
        dismissIntent.setAction(AlarmDismissReceiver.ACTION_DISMISS);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
            this,
            2001,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent snoozeIntent = new Intent(this, AlarmSnoozeReceiver.class);
        snoozeIntent.setAction(AlarmSnoozeReceiver.ACTION_SNOOZE);
        snoozeIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
        snoozeIntent.putExtra(AlarmSnoozeReceiver.EXTRA_SNOOZE_SECONDS, AlarmActivity.SNOOZE_SECONDS);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
            this,
            2004,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Content intent: tapping notification body opens the dedicated AlarmActivity while ringing
        Intent contentIntent = new Intent(this, AlarmActivity.class);
        contentIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
        if (reminderId != null) {
            contentIntent.putExtra(AlarmActivity.EXTRA_REMINDER_ID, reminderId);
        }
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
            this,
            2002,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Full-screen intent: triggers AlarmActivity over lock screen
        Intent fullScreenIntent = new Intent(this, AlarmActivity.class);
        fullScreenIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
        if (reminderId != null) {
            fullScreenIntent.putExtra(AlarmActivity.EXTRA_REMINDER_ID, reminderId);
        }
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            2003,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent viewInVaultIntent = new Intent(this, MainActivity.class);
        viewInVaultIntent.setAction(Intent.ACTION_VIEW);
        viewInVaultIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        viewInVaultIntent.putExtra("stopAlarm", true);
        if (reminderId != null) {
            viewInVaultIntent.putExtra(AlarmActivity.EXTRA_REMINDER_ID, reminderId);
        }
        if (title != null) {
            viewInVaultIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
        }
        PendingIntent viewInVaultPendingIntent = PendingIntent.getActivity(
            this,
            2005,
            viewInVaultIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText("Alarm is ringing. Tap to open, or use Stop/Snooze.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(contentPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "STOP", dismissPendingIntent)
            .addAction(android.R.drawable.ic_popup_reminder, "SNOOZE", snoozePendingIntent)
            .addAction(android.R.drawable.ic_menu_view, "VIEW IN VAULT", viewInVaultPendingIntent);

        Notification notification = builder.build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void startAlarmAudioAndVibration() {
        mediaPlayer = new MediaPlayer();
        boolean customPlayed = false;

        // 1. Try playing cached custom tone if available
        if (AlarmPreferences.hasCustomTone(this)) {
            File customToneFile = AlarmPreferences.getCustomToneFile(this);
            try {
                mediaPlayer.setDataSource(customToneFile.getAbsolutePath());
                mediaPlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
                mediaPlayer.setLooping(true);
                mediaPlayer.prepare();
                mediaPlayer.start();
                customPlayed = true;
            } catch (Exception ex) {
                android.util.Log.e("VaultAlarm", "Failed to play cached custom alarm tone: " + ex.getMessage(), ex);
                mediaPlayer.reset();
            }
        }

        // 2. Fallback to system alarm tone if custom tone was not played
        if (!customPlayed) {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            try {
                mediaPlayer.setDataSource(this, alarmUri);
                mediaPlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
                mediaPlayer.setLooping(true);
                mediaPlayer.prepare();
                mediaPlayer.start();
            } catch (Exception ex) {
                android.util.Log.e("VaultAlarm", "Failed to play fallback system alarm tone: " + ex.getMessage(), ex);
            }
        }

        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = { 0, 600, 400, 600, 400 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && wakeLock == null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Vault:AlarmServiceWakeLock");
                wakeLock.acquire(10 * 60 * 1000L /* 10 minutes max */);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        ringing = false;

        try {
            Intent stoppedIntent = new Intent(AlarmActivity.ACTION_ALARM_STOPPED);
            stoppedIntent.setPackage(getPackageName());
            sendBroadcast(stoppedIntent);
        } catch (Exception ignored) {}

        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
            } catch (Exception ignored) {}
            mediaPlayer.release();
            mediaPlayer = null;
        }

        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {}
            vibrator = null;
        }

        if (wakeLock != null) {
            try {
                if (wakeLock.isHeld()) {
                    wakeLock.release();
                }
            } catch (Exception ignored) {}
            wakeLock = null;
        }

        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
