package app.biblos.mobile;

import android.app.Activity;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tela cheia do leitor: esconde totalmente as barras do sistema (barra de
 * estado + barra de navegação) em modo imersivo. Deslizar a partir da borda
 * mostra-as por instantes, sem sair do modo — e sem aviso do sistema.
 */
@CapacitorPlugin(name = "ImmersiveMode")
public class ImmersiveModePlugin extends Plugin {

  private volatile boolean active = false;

  @PluginMethod
  public void enter(PluginCall call) {
    apply(true, call);
  }

  @PluginMethod
  public void exit(PluginCall call) {
    apply(false, call);
  }

  private void apply(boolean on, PluginCall call) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Activity indisponível");
      return;
    }
    activity.runOnUiThread(() -> {
      try {
        setSystemBarsHidden(activity, on);
        active = on;
        call.resolve();
      } catch (Exception e) {
        call.reject("Modo imersivo falhou", e);
      }
    });
  }

  private static void setSystemBarsHidden(Activity activity, boolean hidden) {
    Window window = activity.getWindow();
    WindowInsetsControllerCompat controller =
      WindowCompat.getInsetsController(window, window.getDecorView());
    if (hidden) {
      controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      );
      controller.hide(WindowInsetsCompat.Type.systemBars());
    } else {
      controller.show(WindowInsetsCompat.Type.systemBars());
    }
  }

  /* Ao voltar à app (ex. multitarefa), o sistema repõe as barras: reaplica. */
  @Override
  protected void handleOnResume() {
    super.handleOnResume();
    if (!active) return;
    Activity activity = getActivity();
    if (activity == null) return;
    activity.runOnUiThread(() -> setSystemBarsHidden(activity, true));
  }
}
