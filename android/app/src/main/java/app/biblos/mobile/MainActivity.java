package app.biblos.mobile;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(ApkInstallerPlugin.class);
    super.onCreate(savedInstanceState);
    // Ne pas clearCache à chaque démarrage : cela cassait les requêtes réseau
    // (auth/planos Firebase + /api) et pouvait faire croire à un état hors ligne.
    ensureRemoteWebViewAccess();
  }

  /**
   * Garante que o WebView pode falar com o provedor remoto (Firebase Auth/Firestore,
   * Google Sign-In) e fazer streaming de áudio (Anchor / CDN HTTPS).
   */
  private void ensureRemoteWebViewAccess() {
    if (this.bridge == null) return;
    WebView webView = this.bridge.getWebView();
    if (webView == null) return;

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setBlockNetworkLoads(false);
    settings.setBlockNetworkImage(false);
    settings.setAllowContentAccess(true);
    settings.setAllowFileAccess(true);
    /* Streaming: após gesto de play, o media player pode continuar o buffer. */
    settings.setMediaPlaybackRequiresUserGesture(false);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
    }
    // Trava o textZoom do sistema — 1rem=16px; leitura só via --bible-font-size.
    settings.setTextZoom(100);
  }

  /**
   * Mantém timers do WebView activos em background para HTMLAudio + Capgo MediaSession FGS.
   * Capacitor pausa o WebView em onPause; re-resume evita cortar o podcast S21.
   */
  @Override
  public void onPause() {
    super.onPause();
    resumeWebViewForMedia();
  }

  @Override
  public void onResume() {
    super.onResume();
    resumeWebViewForMedia();
  }

  private void resumeWebViewForMedia() {
    if (this.bridge == null) return;
    WebView webView = this.bridge.getWebView();
    if (webView == null) return;
    try {
      webView.onResume();
      webView.resumeTimers();
    } catch (Exception ignored) {
      /* ignore */
    }
  }
}
