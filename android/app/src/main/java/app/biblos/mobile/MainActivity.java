package app.biblos.mobile;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Ne pas clearCache à chaque démarrage : cela cassait les requêtes réseau
    // (auth/planos Firebase + /api) et pouvait faire croire à un état hors ligne.
    ensureRemoteWebViewAccess();
  }

  /**
   * Garante que o WebView pode falar com o provedor remoto (Firebase Auth/Firestore,
   * Google Sign-In, APIs Vercel). Capacitor já liga JS; reforçamos rede + storage.
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
    // Trava o textZoom do sistema — 1rem=16px; leitura só via --bible-font-size.
    settings.setTextZoom(100);
  }
}
