package at.spanwerk.maschinenstundensatz;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Prüft beim Start, ob auf GitHub eine neuere Version bereitsteht, lädt diese
 * auf Wunsch herunter und startet die Installation. Komplett optional: Ist kein
 * Netz vorhanden oder der Server nicht erreichbar, passiert einfach nichts.
 */
class Updater {

    private static final String VERSION_URL =
            "https://warscher80.github.io/spanwerk-datenschutz/version.json";

    private final Activity activity;

    Updater(Activity activity) {
        this.activity = activity;
    }

    void checkInBackground() {
        new Thread(this::run).start();
    }

    private void run() {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(VERSION_URL).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setRequestProperty("Cache-Control", "no-cache");
            if (c.getResponseCode() != 200) return;

            StringBuilder sb = new StringBuilder();
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();

            JSONObject json = new JSONObject(sb.toString());
            int latest = json.getInt("versionCode");
            final String name = json.optString("versionName", "");
            final String url = json.getString("apkUrl");
            final String notes = json.optString("notes", "");

            if (latest > BuildConfig.VERSION_CODE) {
                activity.runOnUiThread(() -> promptUpdate(name, url, notes));
            }
        } catch (Exception ignored) {
            // offline oder Server nicht erreichbar -> stillschweigend ignorieren
        }
    }

    private void promptUpdate(String name, String url, String notes) {
        String msg = "Version " + name + " ist verfügbar.";
        if (notes != null && !notes.isEmpty()) msg += "\n\n" + notes;
        new AlertDialog.Builder(activity)
                .setTitle("Update verfügbar")
                .setMessage(msg)
                .setPositiveButton("Aktualisieren", (d, w) -> startUpdate(url))
                .setNegativeButton("Später", null)
                .show();
    }

    private void startUpdate(String url) {
        // Ab Android 8 muss das Installieren aus dieser App einmalig erlaubt werden.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(activity,
                    "Bitte Installation für diese App erlauben, dann erneut auf Aktualisieren tippen.",
                    Toast.LENGTH_LONG).show();
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(i);
            return;
        }
        download(url);
    }

    private void download(String url) {
        File dir = new File(activity.getExternalFilesDir(null), "updates");
        if (!dir.exists()) dir.mkdirs();
        final File apk = new File(dir, "update.apk");
        if (apk.exists()) apk.delete();

        DownloadManager dm = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
        req.setTitle("Maschinenstundensatz-Update");
        req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        req.setDestinationUri(Uri.fromFile(apk));
        final long id = dm.enqueue(req);

        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                long done = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (done != id) return;
                ctx.unregisterReceiver(this);
                install(apk);
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            activity.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            activity.registerReceiver(receiver, filter);
        }
        Toast.makeText(activity, "Update wird geladen …", Toast.LENGTH_SHORT).show();
    }

    private void install(File apk) {
        Uri uri = FileProvider.getUriForFile(activity,
                activity.getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(i);
    }
}
