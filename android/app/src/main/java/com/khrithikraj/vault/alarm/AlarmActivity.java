package com.khrithikraj.vault.alarm;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.khrithikraj.vault.MainActivity;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * AlarmActivity — Refined full-screen native alarm screen aligned with Raj's Vault aesthetic.
 *
 * Visual Rhythm:
 * - Restrained RAJ'S VAULT header with subtle copper RINGING pill
 * - Scaled, elegant 46sp clock + italic serif localized date
 * - Proximity-connected reminder card (18dp spacing, 12dp radius, #1A110A surface)
 * - Dynamic clock updates via a Handler (prevents stale minute across alarms)
 * - Flexible vertical pacing with no visible scrollbar
 * - Tactile, accessible STOP ALARM (48dp, #C44800) and SNOOZE (44dp, #1C130C)
 * - Quiet "VIEW IN VAULT →" link that opens MainActivity only when explicitly tapped
 * - Proper window-inset handling for status bar, navigation bar, and display cutouts
 */
public class AlarmActivity extends Activity {

    public static final String ACTION_ALARM_STOPPED = "com.khrithikraj.vault.ACTION_ALARM_STOPPED";
    public static final String EXTRA_TITLE = "title";
    public static final int SNOOZE_SECONDS = 5 * 60; // 5 minutes

    // ─── Vault Design Tokens ──────────────────────────────────────────────────
    private static final int COLOR_BG             = Color.parseColor("#140C07");
    private static final int COLOR_SURFACE        = Color.parseColor("#1A110A");
    private static final int COLOR_BORDER         = Color.parseColor("#2E2218");
    private static final int COLOR_BORDER_STRONG  = Color.parseColor("#382416");
    private static final int COLOR_CREAM          = Color.parseColor("#FFEDD7");
    private static final int COLOR_STONE          = Color.parseColor("#A89886");
    private static final int COLOR_MUTED          = Color.parseColor("#7A6E60");
    private static final int COLOR_ACCENT_STOP    = Color.parseColor("#C44800");
    private static final int COLOR_SNOOZE_BG      = Color.parseColor("#1C130C");

    // ─── State ───────────────────────────────────────────────────────────────
    private TextView titleTextView;
    private TextView clockView;
    private TextView amPmView;
    private TextView dateView;

    private final Handler clockHandler = new Handler(Looper.getMainLooper());
    private final Runnable clockTicker = new Runnable() {
        @Override
        public void run() {
            updateClock();
            // Schedule next tick at the start of the next second
            clockHandler.postDelayed(this, 1000L);
        }
    };

    private final BroadcastReceiver stopReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            finish();
        }
    };

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        applyLockScreenFlags();
        configureSystemBars();
        buildVaultUI();
        registerStopReceiver();
        // Start live clock
        clockHandler.post(clockTicker);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Ensure clock is always live when activity is in the foreground
        clockHandler.removeCallbacks(clockTicker);
        clockHandler.post(clockTicker);
    }

    @Override
    protected void onPause() {
        super.onPause();
        clockHandler.removeCallbacks(clockTicker);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applyLockScreenFlags();
        if (intent != null && titleTextView != null) {
            String newTitle = intent.getStringExtra(EXTRA_TITLE);
            if (newTitle != null && !newTitle.trim().isEmpty()) {
                titleTextView.setText(newTitle);
            }
        }
    }

    @Override
    protected void onDestroy() {
        clockHandler.removeCallbacks(clockTicker);
        try {
            unregisterReceiver(stopReceiver);
        } catch (IllegalArgumentException ignored) {
            // Receiver was not registered
        }
        super.onDestroy();
    }

    // ─── Clock Updates ───────────────────────────────────────────────────────

    private void updateClock() {
        if (clockView == null || amPmView == null || dateView == null) return;
        Date now = new Date();
        clockView.setText(new SimpleDateFormat("hh:mm", Locale.getDefault()).format(now));
        amPmView.setText(" " + new SimpleDateFormat("a", Locale.getDefault())
                .format(now).toUpperCase(Locale.getDefault()));
        dateView.setText(new SimpleDateFormat("EEEE, MMMM d", Locale.getDefault()).format(now));
    }

    // ─── Lock-screen & System Bars ───────────────────────────────────────────

    private void applyLockScreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            Window w = getWindow();
            //noinspection deprecation
            w.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private void configureSystemBars() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(COLOR_BG);
            window.setNavigationBarColor(COLOR_BG);
        }
        // Allow content to draw edge-to-edge so we can apply insets manually
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            //noinspection deprecation
            window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }

    // ─── UI Construction ────────────────────────────────────────────────────

    private void buildVaultUI() {
        // Root scroll container — no visible scrollbar, fills viewport
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(COLOR_BG);
        scrollView.setVerticalScrollBarEnabled(false);
        scrollView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // Primary vertical layout — applies window insets dynamically
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(COLOR_BG);
        // Base padding; insets listener will add status / nav bar insets on top
        root.setPadding(dp(24), dp(20), dp(24), dp(20));

        // Window insets listener — adds status bar + navigation bar padding
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                int statusBarInset = 0;
                int navBarInset = 0;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    android.view.WindowInsets.Type type = null;
                    statusBarInset = insets.getInsets(
                        WindowInsets.Type.statusBars()).top;
                    navBarInset = insets.getInsets(
                        WindowInsets.Type.navigationBars()).bottom;
                } else {
                    //noinspection deprecation
                    statusBarInset = insets.getSystemWindowInsetTop();
                    //noinspection deprecation
                    navBarInset = insets.getSystemWindowInsetBottom();
                }

                // Apply safe-area aware padding
                v.setPadding(dp(24), dp(20) + statusBarInset, dp(24), dp(20) + navBarInset);
                return insets;
            });
        }

        // ── 1. Header: RAJ'S VAULT wordmark + copper RINGING indicator ────────

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setGravity(Gravity.CENTER_HORIZONTAL);

        TextView wordmark = new TextView(this);
        wordmark.setText("RAJ'S VAULT");
        wordmark.setTextSize(11f);
        wordmark.setTextColor(COLOR_MUTED);
        wordmark.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            wordmark.setLetterSpacing(0.22f);
        }
        wordmark.setGravity(Gravity.CENTER);
        header.addView(wordmark, wrapParams(0, dp(4)));

        TextView statusPill = new TextView(this);
        statusPill.setText("●  RINGING");
        statusPill.setTextSize(11f);
        statusPill.setTextColor(COLOR_ACCENT_STOP);
        statusPill.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            statusPill.setLetterSpacing(0.14f);
        }
        statusPill.setGravity(Gravity.CENTER);
        header.addView(statusPill, wrapParams(0, 0));

        LinearLayout.LayoutParams headerParams = matchParams(LinearLayout.LayoutParams.WRAP_CONTENT);
        headerParams.bottomMargin = dp(28);
        root.addView(header, headerParams);

        // ── 2. Clock & Date ───────────────────────────────────────────────────

        Date now = new Date();

        LinearLayout timeRow = new LinearLayout(this);
        timeRow.setOrientation(LinearLayout.HORIZONTAL);
        timeRow.setGravity(Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);

        clockView = new TextView(this);
        clockView.setText(new SimpleDateFormat("hh:mm", Locale.getDefault()).format(now));
        clockView.setTextSize(46f);
        clockView.setTextColor(COLOR_CREAM);
        clockView.setTypeface(Typeface.create("sans-serif-light", Typeface.NORMAL));
        clockView.setIncludeFontPadding(false);
        timeRow.addView(clockView);

        amPmView = new TextView(this);
        amPmView.setText(" " + new SimpleDateFormat("a", Locale.getDefault())
                .format(now).toUpperCase(Locale.getDefault()));
        amPmView.setTextSize(14f);
        amPmView.setTextColor(COLOR_STONE);
        amPmView.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        amPmView.setPadding(dp(2), 0, 0, dp(8));
        timeRow.addView(amPmView);

        LinearLayout.LayoutParams timeRowParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        timeRowParams.gravity = Gravity.CENTER_HORIZONTAL;
        timeRowParams.bottomMargin = dp(4);
        root.addView(timeRow, timeRowParams);

        dateView = new TextView(this);
        dateView.setText(new SimpleDateFormat("EEEE, MMMM d", Locale.getDefault()).format(now));
        dateView.setTextSize(14f);
        dateView.setTextColor(COLOR_STONE);
        dateView.setTypeface(Typeface.create("serif", Typeface.ITALIC));
        dateView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams dateParams = matchParams(LinearLayout.LayoutParams.WRAP_CONTENT);
        dateParams.bottomMargin = dp(28);
        root.addView(dateView, dateParams);

        // ── 3. Reminder Card ─────────────────────────────────────────────────

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(20), dp(18), dp(20), dp(18));

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(COLOR_SURFACE);
        cardBg.setStroke(dp(1), COLOR_BORDER);
        cardBg.setCornerRadius(dp(12));
        card.setBackground(cardBg);

        TextView cardLabel = new TextView(this);
        cardLabel.setText("REMINDER");
        cardLabel.setTextSize(11f);
        cardLabel.setTextColor(COLOR_MUTED);
        cardLabel.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cardLabel.setLetterSpacing(0.20f);
        }
        cardLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        labelParams.bottomMargin = dp(10);
        card.addView(cardLabel, labelParams);

        String title = getIntent() != null ? getIntent().getStringExtra(EXTRA_TITLE) : null;
        if (title == null || title.trim().isEmpty()) {
            title = "Vault Alarm";
        }

        titleTextView = new TextView(this);
        titleTextView.setText(title);
        titleTextView.setTextSize(21f);
        titleTextView.setTextColor(COLOR_CREAM);
        titleTextView.setTypeface(Typeface.create("serif", Typeface.BOLD));
        titleTextView.setGravity(Gravity.CENTER);
        titleTextView.setMaxLines(4);
        titleTextView.setLineSpacing(dp(2), 1.18f);
        card.addView(titleTextView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout.LayoutParams cardParams = matchParams(LinearLayout.LayoutParams.WRAP_CONTENT);
        cardParams.bottomMargin = 0;
        root.addView(card, cardParams);

        // ── 4. Flexible Spacer — pushes actions to bottom on tall screens ────

        View flexSpacer = new View(this);
        LinearLayout.LayoutParams spacerParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(20), 1.0f);
        root.addView(flexSpacer, spacerParams);

        // ── 5. Action Controls ───────────────────────────────────────────────

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.VERTICAL);

        // Primary: STOP ALARM — copper, 48dp, bold
        Button stopBtn = new Button(this);
        stopBtn.setText("STOP ALARM");
        stopBtn.setTextSize(14f);
        stopBtn.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        stopBtn.setTextColor(Color.WHITE);
        stopBtn.setAllCaps(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            stopBtn.setLetterSpacing(0.08f);
        }
        GradientDrawable stopBg = new GradientDrawable();
        stopBg.setColor(COLOR_ACCENT_STOP);
        stopBg.setCornerRadius(dp(10));
        stopBtn.setBackground(stopBg);
        stopBtn.setOnClickListener(v -> handleStop());
        LinearLayout.LayoutParams stopParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(48));
        stopParams.bottomMargin = dp(10);
        actions.addView(stopBtn, stopParams);

        // Secondary: SNOOZE (5 MIN) — dark brown surface, subtle border, 44dp
        Button snoozeBtn = new Button(this);
        snoozeBtn.setText("SNOOZE  (5 MIN)");
        snoozeBtn.setTextSize(14f);
        snoozeBtn.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        snoozeBtn.setTextColor(COLOR_CREAM);
        snoozeBtn.setAllCaps(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            snoozeBtn.setLetterSpacing(0.08f);
        }
        GradientDrawable snoozeBg = new GradientDrawable();
        snoozeBg.setColor(COLOR_SNOOZE_BG);
        snoozeBg.setStroke(dp(1), COLOR_BORDER_STRONG);
        snoozeBg.setCornerRadius(dp(10));
        snoozeBtn.setBackground(snoozeBg);
        snoozeBtn.setOnClickListener(v -> handleSnooze());
        LinearLayout.LayoutParams snoozeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(44));
        snoozeParams.bottomMargin = dp(10);
        actions.addView(snoozeBtn, snoozeParams);

        // Tertiary: VIEW IN VAULT → — quiet text action
        Button viewInVaultBtn = new Button(this);
        viewInVaultBtn.setText("VIEW IN VAULT →");
        viewInVaultBtn.setTextSize(12f);
        viewInVaultBtn.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        viewInVaultBtn.setTextColor(COLOR_STONE);
        viewInVaultBtn.setAllCaps(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            viewInVaultBtn.setLetterSpacing(0.10f);
        }
        viewInVaultBtn.setBackgroundColor(Color.TRANSPARENT);
        viewInVaultBtn.setOnClickListener(v -> handleViewInVault());
        actions.addView(viewInVaultBtn, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(38)));

        LinearLayout.LayoutParams actionsParams = matchParams(LinearLayout.LayoutParams.WRAP_CONTENT);
        actionsParams.topMargin = dp(12);
        root.addView(actions, actionsParams);

        scrollView.addView(root);
        setContentView(scrollView);
    }

    // ─── Actions ─────────────────────────────────────────────────────────────

    /** Stop: silences sound/vibration, cancels active notification, closes screen. */
    private void handleStop() {
        AlarmService.stopAlarm(this);
        finish();
    }

    /** Snooze: silences sound, reschedules one alarm for SNOOZE_SECONDS, closes screen. */
    private void handleSnooze() {
        AlarmService.stopAlarm(this);

        Intent snoozeIntent = new Intent(this, AlarmSnoozeReceiver.class);
        snoozeIntent.setAction(AlarmSnoozeReceiver.ACTION_SNOOZE);
        snoozeIntent.putExtra(EXTRA_TITLE, getTitleFromIntent());
        snoozeIntent.putExtra(AlarmSnoozeReceiver.EXTRA_SNOOZE_SECONDS, SNOOZE_SECONDS);
        String reminderId = getReminderIdFromIntent();
        if (reminderId != null && !reminderId.trim().isEmpty()) {
            snoozeIntent.putExtra(EXTRA_REMINDER_ID, reminderId.trim());
        }
        sendBroadcast(snoozeIntent);
        finish();
    }

    /** View in Vault: requests keyguard dismissal if locked, silences alarm, and opens MainActivity with reminder ID. */
    private void handleViewInVault() {
        final String reminderId = getReminderIdFromIntent();
        final String title = getTitleFromIntent();

        Runnable launchMainActivity = () -> {
            AlarmService.stopAlarm(AlarmActivity.this);
            Intent vaultIntent = new Intent(AlarmActivity.this, MainActivity.class);
            vaultIntent.setAction(Intent.ACTION_VIEW);
            vaultIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            if (reminderId != null && !reminderId.trim().isEmpty()) {
                vaultIntent.putExtra(EXTRA_REMINDER_ID, reminderId);
            }
            if (title != null && !title.trim().isEmpty()) {
                vaultIntent.putExtra(EXTRA_TITLE, title);
            }
            startActivity(vaultIntent);
            finish();
        };

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.KeyguardManager km = (android.app.KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null && km.isKeyguardLocked()) {
                km.requestDismissKeyguard(this, new android.app.KeyguardManager.KeyguardDismissCallback() {
                    @Override
                    public void onDismissSucceeded() {
                        launchMainActivity.run();
                    }

                    @Override
                    public void onDismissCancelled() {
                        // User cancelled unlock, keep alarm screen showing
                    }

                    @Override
                    public void onDismissError() {
                        launchMainActivity.run();
                    }
                });
                return;
            }
        }

        launchMainActivity.run();
    }

    public static final String EXTRA_REMINDER_ID = "reminderId";

    private String getReminderIdFromIntent() {
        if (getIntent() == null) return null;
        return getIntent().getStringExtra(EXTRA_REMINDER_ID);
    }

    private String getTitleFromIntent() {
        if (getIntent() == null) return "Vault Alarm";
        String t = getIntent().getStringExtra(EXTRA_TITLE);
        return (t != null && !t.trim().isEmpty()) ? t : "Vault Alarm";
    }

    // ─── Stop Receiver ───────────────────────────────────────────────────────

    private void registerStopReceiver() {
        IntentFilter filter = new IntentFilter(ACTION_ALARM_STOPPED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stopReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(stopReceiver, filter);
        }
    }

    // ─── Layout Helpers ──────────────────────────────────────────────────────

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    /** WRAP_CONTENT × WRAP_CONTENT params with optional bottom margin. */
    private LinearLayout.LayoutParams wrapParams(int topMargin, int bottomMargin) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        p.topMargin = topMargin;
        p.bottomMargin = bottomMargin;
        return p;
    }

    /** MATCH_PARENT × height params with zero margins (caller can set after). */
    private LinearLayout.LayoutParams matchParams(int height) {
        return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, height);
    }
}
