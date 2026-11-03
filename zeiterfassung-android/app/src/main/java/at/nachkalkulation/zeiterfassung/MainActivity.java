package at.nachkalkulation.zeiterfassung;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends Activity {

    private WebView web;
    // Referenz, damit der TimerService Benachrichtigungs-Tasten an die Web-App weiterreichen kann.
    static WebView sWeb;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        sWeb = web;
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // localStorage fuer gespeicherte Zeiten
        // Aktiviert JS-Dialoge (alert/confirm/prompt) in der WebView.
        web.setWebChromeClient(new WebChromeClient());
        // Bruecke JS -> nativ fuer die laufende Benachrichtigung.
        web.addJavascriptInterface(new TimerBridge(this), "AndroidTimer");
        web.loadUrl("file:///android_asset/zeiterfassung.html");

        setContentView(web);

        requestNotifPermission();

        // Beim Start im Hintergrund auf eine neuere Version pruefen.
        new Updater(this).checkInBackground();
    }

    private void requestNotifPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
                }
            } catch (Exception ignored) {}
        }
    }

    /** Fuehrt JS im WebView aus (vom TimerService bei Tastendruck aufgerufen). */
    static void runJs(final String js) {
        final WebView w = sWeb;
        if (w == null) return;
        w.post(new Runnable() {
            @Override public void run() {
                try { w.evaluateJavascript(js, null); } catch (Exception ignored) {}
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (sWeb == web) sWeb = null;
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** JS -> nativ: aktualisiert/beendet die laufende Benachrichtigung. */
    public static class TimerBridge {
        private final Activity act;
        TimerBridge(Activity a) { act = a; }

        @JavascriptInterface
        public void setState(boolean active, boolean running, String title, String project, double value) {
            try {
                Intent i = new Intent(act, TimerService.class);
                if (!active) {
                    i.setAction(TimerService.ACTION_CLEAR);
                    act.startService(i);
                    return;
                }
                i.setAction(TimerService.ACTION_UPDATE);
                i.putExtra("running", running);
                i.putExtra("title", title == null ? "" : title);
                i.putExtra("project", project == null ? "" : project);
                i.putExtra("value", (long) value);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) act.startForegroundService(i);
                else act.startService(i);
            } catch (Exception ignored) {}
        }
    }
}
