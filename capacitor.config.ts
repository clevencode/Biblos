import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.biblos.mobile",
  appName: "Biblos",
  webDir: "dist",
  server: {
    // App native charge la PWA hébergée (évite localhost sur mobile).
    url: "https://biblos-two.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#FFFFFF",
      overlaysWebView: false,
    },
    LocalNotifications: {
      smallIcon: "ic_launcher",
      iconColor: "#2563eb",
    },
  },
};

export default config;
