package com.khrithikraj.vault;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.khrithikraj.vault.alarm.AlarmActivity;
import com.khrithikraj.vault.alarm.AlarmService;
import com.khrithikraj.vault.alarm.VaultAlarmPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "VaultInsets";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(VaultAlarmPlugin.class);
        super.onCreate(savedInstanceState);
        applyKeyboardAwareInsets();
        handleAlarmIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAlarmIntent(intent);
    }

    /**
     * Shrinks the Capacitor WebView to the area that is actually visible.
     *
     * The app targets SDK 35, so Android 15+ enforces edge-to-edge and
     * `adjustResize` no longer resizes the window for the soft keyboard.
     * Capacitor's own edge-to-edge handler only applies system-bar and
     * display-cutout margins and then consumes the insets, so the IME inset
     * never reaches the page: the web viewport keeps its full height while the
     * keyboard covers the lower half, and CSS `100%` / `dvh` still measure the
     * keyboard-covered viewport.
     *
     * This listener mirrors Capacitor's system-bar/cutout margins and adds the
     * IME inset on Android 15+ only. Below API 35 the framework still pads the
     * window's root views for the keyboard, so adding the IME inset there
     * would count the keyboard height twice.
     */
    private void applyKeyboardAwareInsets() {
        if (getBridge() == null) return;
        View webView = getBridge().getWebView();
        if (webView == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            int types = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                types |= WindowInsetsCompat.Type.ime();
            }

            Insets insets = windowInsets.getInsets(types);
            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
            lp.leftMargin = insets.left;
            lp.topMargin = insets.top;
            lp.rightMargin = insets.right;
            lp.bottomMargin = insets.bottom;
            view.setLayoutParams(lp);

            Log.d(TAG, "webview insets applied: l=" + insets.left + " t=" + insets.top
                + " r=" + insets.right + " b=" + insets.bottom
                + " webViewHeight=" + view.getHeight());

            return WindowInsetsCompat.CONSUMED;
        });

        ViewCompat.requestApplyInsets(webView);
    }

    private void handleAlarmIntent(Intent intent) {
        if (intent == null) return;
        if (intent.getBooleanExtra("stopAlarm", false)) {
            AlarmService.stopAlarm(this);
        }
        String reminderId = intent.getStringExtra(AlarmActivity.EXTRA_REMINDER_ID);
        if (reminderId == null || reminderId.trim().isEmpty()) {
            reminderId = intent.getStringExtra("reminderId");
        }
        if (reminderId != null && !reminderId.trim().isEmpty()) {
            VaultAlarmPlugin.setLaunchReminderId(reminderId.trim());
        }
    }
}
