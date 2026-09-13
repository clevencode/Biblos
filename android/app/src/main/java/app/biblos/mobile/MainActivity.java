package app.biblos.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Ne pas clearCache à chaque démarrage : cela cassait les requêtes réseau
    // et pouvait faire croire à un état hors ligne avec la connexion active.
  }
}
