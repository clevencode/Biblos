import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.biblos.mobile",
  appName: "Biblos",
  webDir: "dist",
  // Pas de server.url : l’APK embarque le build local.
  // Les /api passent par apiUrl() → https://biblos-two.vercel.app (+ CapacitorHttp).
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Bypass CORS pour les fetch /api vers Vercel depuis le WebView bundlé.
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0D1117",
      overlaysWebView: false,
    },
    LocalNotifications: {
      smallIcon: "ic_launcher",
      iconColor: "#FFFFFF",
    },
  },
};

export default config;
