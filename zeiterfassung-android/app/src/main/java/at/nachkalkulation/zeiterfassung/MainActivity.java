package at.nachkalkulation.zeiterfassung;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // localStorage fuer gespeicherte Zeiten
        web.loadUrl("file:///android_asset/zeiterfassung.html");

        setContentView(web);

        // Beim Start im Hintergrund auf eine neuere Version pruefen.
        new Updater(this).checkInBackground();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
