package at.nachkalkulation.zeiterfassung;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

/**
 * Zeigt waehrend einer laufenden/pausierten Taetigkeit eine dauerhafte
 * Benachrichtigung (Statusleiste + Sperrbildschirm) mit mitlaufender Zeit und
 * den Tasten Pause/Weiter und Stopp. Der Dienst haelt seinen eigenen Zustand,
 * damit die Tasten auch bei gesperrtem Bildschirm sofort reagieren; parallel
 * wird die Web-App ueber MainActivity.runJs synchron gehalten.
 */
public class TimerService extends Service {

    static final String ACTION_UPDATE = "at.nachkalkulation.zeiterfassung.UPDATE";
    static final String ACTION_CLEAR  = "at.nachkalkulation.zeiterfassung.CLEAR";
    static final String ACTION_TOGGLE = "at.nachkalkulation.zeiterfassung.TOGGLE";
    static final String ACTION_STOP   = "at.nachkalkulation.zeiterfassung.STOP";

    private static final String CHANNEL = "timer";
    private static final int NOTIF_ID = 1001;

    private boolean active = false;
    private boolean running = false;
    private long whenBase = 0L;   // currentTimeMillis-Basis der Stoppuhr (laufend)
    private long frozenSec = 0L;  // angezeigte Sekunden (pausiert)
    private String title = "";
    private String project = "";

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE.equals(action)) {
            active = true;
            running = intent.getBooleanExtra("running", false);
            title = intent.getStringExtra("title");
            project = intent.getStringExtra("project");
            long value = intent.getLongExtra("value", 0L);
            if (running) whenBase = value; else frozenSec = value;
            safeForeground(build());
        } else if (ACTION_TOGGLE.equals(action)) {
            long now = System.currentTimeMillis();
            if (running) { frozenSec = Math.max(0, (now - whenBase) / 1000L); running = false; }
            else { whenBase = now - frozenSec * 1000L; running = true; }
            if (active) safeForeground(build());
            MainActivity.runJs("window.__nativeToggle&&window.__nativeToggle()");
        } else if (ACTION_STOP.equals(action)) {
            MainActivity.runJs("window.__nativeStop&&window.__nativeStop()");
            stopSelfSafe();
        } else if (ACTION_CLEAR.equals(action)) {
            stopSelfSafe();
        }
        return START_NOT_STICKY;
    }

    private void safeForeground(Notification n) {
        try { startForeground(NOTIF_ID, n); } catch (Exception ignored) {}
    }

    private void stopSelfSafe() {
        active = false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(Service.STOP_FOREGROUND_REMOVE);
            else stopForeground(true);
        } catch (Exception ignored) {}
        stopSelf();
    }

    private PendingIntent svc(String action) {
        Intent i = new Intent(this, TimerService.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, action.hashCode(), i, flags);
    }

    private Notification build() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = nm.getNotificationChannel(CHANNEL);
            if (ch == null) {
                ch = new NotificationChannel(CHANNEL, "Laufende Zeiterfassung",
                        NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }

        Intent open = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        int pf = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) pf |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, pf);

        Notification.Builder b = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(this, CHANNEL)
                : new Notification.Builder(this);

        b.setSmallIcon(R.drawable.ic_stat_timer)
         .setContentTitle(title == null || title.isEmpty() ? "Zeiterfassung" : title)
         .setOngoing(true)
         .setOnlyAlertOnce(true)
         .setContentIntent(openPi)
         .setVisibility(Notification.VISIBILITY_PUBLIC);

        if (Build.VERSION.SDK_INT >= 21) b.setCategory(Notification.CATEGORY_STOPWATCH);

        String sub = (project == null ? "" : project);
        if (running) {
            b.setUsesChronometer(true);
            b.setWhen(whenBase);
            b.setShowWhen(true);
            b.setContentText(sub.isEmpty() ? "läuft" : sub);
            b.addAction(0, "Pause", svc(ACTION_TOGGLE));
        } else {
            b.setShowWhen(false);
            b.setContentText((sub.isEmpty() ? "" : sub + " · ") + fmt(frozenSec) + " · pausiert");
            b.addAction(0, "Weiter", svc(ACTION_TOGGLE));
        }
        b.addAction(0, "Stopp", svc(ACTION_STOP));
        return b.build();
    }

    private static String fmt(long sec) {
        if (sec < 0) sec = 0;
        long h = sec / 3600, m = (sec % 3600) / 60, s = sec % 60;
        return String.format("%02d:%02d:%02d", h, m, s);
    }
}
