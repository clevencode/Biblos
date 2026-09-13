package app.biblos.mobile;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    clearWebViewCaches();
  }

  @Override
  public void onStart() {
    super.onStart();
    clearWebViewCaches();
  }

  private void clearWebViewCaches() {
    if (getBridge() == null) return;
    WebView webView = getBridge().getWebView();
    if (webView == null) return;
    webView.clearCache(true);
    webView.clearFormData();
    webView.clearHistory();
  }
}
