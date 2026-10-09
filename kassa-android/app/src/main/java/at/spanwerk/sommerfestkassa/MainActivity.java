package at.spanwerk.sommerfestkassa;

import android.app.Activity;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.OutputStream;

/**
 * Sommerfest Kassa – Android-Hülle.
 * Lädt die mitgelieferte kassa.html komplett offline in einem WebView.
 * Keine Internet-Berechtigung, kein Tracking, alle Daten bleiben lokal.
 */
public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);        // App-Logik
        s.setDomStorageEnabled(true);        // localStorage (Kassendaten) – bleibt dauerhaft erhalten
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);

        // JS-Dialoge (PIN-Abfrage, Bestätigungen, Hinweise) anzeigen
        web.setWebChromeClient(new WebChromeClient());

        // „Statistik speichern“ (data:-PNG) in die Galerie sichern
        web.setDownloadListener((url, ua, cd, mime, len) -> saveDataUrl(url));

        web.loadUrl("file:///android_asset/kassa.html");
        setContentView(web);
    }

    /** Speichert ein data:image/png;base64,... in die Bilder-Galerie (Ordner „Sommerfest Kassa“). */
    private void saveDataUrl(String url) {
        try {
            if (url == null || !url.startsWith("data:")) return;
            int comma = url.indexOf(',');
            if (comma < 0) return;
            byte[] data = Base64.decode(url.substring(comma + 1), Base64.DEFAULT);
            String name = "sommerfest-statistik-" + System.currentTimeMillis() + ".png";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                cv.put(MediaStore.Images.Media.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/Sommerfest Kassa");
                Uri uri = getContentResolver().insert(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri != null) {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os != null) { os.write(data); os.close(); }
                }
            } else {
                java.io.File dir = new java.io.File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                        "Sommerfest Kassa");
                if (!dir.exists()) dir.mkdirs();
                java.io.File f = new java.io.File(dir, name);
                java.io.FileOutputStream fos = new java.io.FileOutputStream(f);
                fos.write(data); fos.close();
            }
            Toast.makeText(this, "Statistik in der Galerie gespeichert", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Speichern nicht möglich – bitte QR-Code nutzen.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
