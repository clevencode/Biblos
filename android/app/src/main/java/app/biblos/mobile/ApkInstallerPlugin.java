package app.biblos.mobile;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Descarrega o APK para um único ficheiro em cache ({@code Biblos.apk}) e
 * abre o instalador — sobrescreve a cada update (sem acumular em Downloads).
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

  private static final String APK_NAME = "Biblos.apk";
  private static final int CONNECT_TIMEOUT_MS = 30_000;
  private static final int READ_TIMEOUT_MS = 120_000;

  private final ExecutorService executor = Executors.newSingleThreadExecutor();

  @PluginMethod
  public void downloadAndInstall(PluginCall call) {
    String url = call.getString("url");
    if (url == null || url.trim().isEmpty()) {
      call.reject("url em falta");
      return;
    }
    final String downloadUrl = url.trim();

    if (!canInstallPackages()) {
      openUnknownSourcesSettings();
      call.reject("permitir instalação de fontes desconhecidas");
      return;
    }

    executor.execute(
      () -> {
        File apkFile = null;
        try {
          apkFile = downloadToCache(downloadUrl);
          File finalFile = apkFile;
          getActivity()
            .runOnUiThread(
              () -> {
                try {
                  launchInstaller(finalFile);
                  call.resolve();
                } catch (Exception e) {
                  call.reject("falha ao abrir instalador: " + e.getMessage(), e);
                }
              }
            );
        } catch (Exception e) {
          if (apkFile != null && apkFile.exists()) {
            // ignore: próximo update sobrescreve
          }
          call.reject("falha no download: " + e.getMessage(), e);
        }
      }
    );
  }

  private boolean canInstallPackages() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return true;
    }
    PackageManager pm = getContext().getPackageManager();
    return pm.canRequestPackageInstalls();
  }

  private void openUnknownSourcesSettings() {
    Intent intent = new Intent(
      Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
      Uri.parse("package:" + getContext().getPackageName())
    );
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(intent);
  }

  private File downloadToCache(String downloadUrl) throws Exception {
    File target = new File(getContext().getCacheDir(), APK_NAME);
    if (target.exists() && !target.delete()) {
      throw new IllegalStateException("não foi possível apagar APK anterior");
    }

    HttpURLConnection conn = null;
    try {
      URL url = new URL(downloadUrl);
      conn = (HttpURLConnection) url.openConnection();
      conn.setInstanceFollowRedirects(true);
      conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
      conn.setReadTimeout(READ_TIMEOUT_MS);
      conn.setRequestMethod("GET");
      conn.setRequestProperty("Accept", "application/vnd.android.package-archive,*/*");
      conn.connect();

      int code = conn.getResponseCode();
      // Seguir um redirect manual se necessário (HTTP→HTTPS).
      if (
        code == HttpURLConnection.HTTP_MOVED_PERM ||
        code == HttpURLConnection.HTTP_MOVED_TEMP ||
        code == HttpURLConnection.HTTP_SEE_OTHER ||
        code == 307 ||
        code == 308
      ) {
        String location = conn.getHeaderField("Location");
        conn.disconnect();
        if (location == null || location.isEmpty()) {
          throw new IllegalStateException("redirect sem Location");
        }
        return downloadToCache(location);
      }

      if (code < 200 || code >= 300) {
        throw new IllegalStateException("HTTP " + code);
      }

      try (
        InputStream in = conn.getInputStream();
        FileOutputStream out = new FileOutputStream(target, false)
      ) {
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) {
          out.write(buf, 0, n);
        }
        out.flush();
      }

      if (!target.exists() || target.length() == 0) {
        throw new IllegalStateException("APK vazio após download");
      }
      return target;
    } finally {
      if (conn != null) {
        conn.disconnect();
      }
    }
  }

  private void launchInstaller(File apkFile) {
    Uri uri = FileProvider.getUriForFile(
      getContext(),
      getContext().getPackageName() + ".fileprovider",
      apkFile
    );
    Intent intent = new Intent(Intent.ACTION_VIEW);
    intent.setDataAndType(uri, "application/vnd.android.package-archive");
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(intent);
  }

  @Override
  protected void handleOnDestroy() {
    executor.shutdownNow();
    super.handleOnDestroy();
  }
}
