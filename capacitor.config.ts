import type { CapacitorConfig } from "@capacitor/cli";

/**
 * WebView APK: assets locais (sem server.url).
 * Auth + planos → Firebase (JS SDK + Google nativo).
 * APIs auxiliares → https://biblos-two.vercel.app via apiUrl() + CapacitorHttp.
 */
const config: CapacitorConfig = {
  appId: "app.biblos.mobile",
  appName: "Biblos",
  webDir: "dist",
  server: {
    // Permite o WebView sair do shell local para OAuth / links do provedor remoto.
    allowNavigation: [
      "*.firebaseapp.com",
      "*.web.app",
      "*.googleapis.com",
      "*.gstatic.com",
      "*.google.com",
      "*.googleusercontent.com",
      "*.firebaseio.com",
      "*.cloudfunctions.net",
      "biblos-two.vercel.app",
      "*.vercel.app",
    ],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Bypass CORS para fetch /api (Vercel) e XHR cross-origin no WebView bundlé.
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0D1117",
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#0D1117",
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: "ic_launcher",
      iconColor: "#FFFFFF",
    },
    FirebaseAuthentication: {
      // false = plugin nativo + credential → Firebase JS (auth remoto no APK).
      skipNativeAuth: false,
      providers: ["google.com"],
    },
  },
};

export default config;
