import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.biblos.mobile",
  appName: "Biblos",
  webDir: "dist",
  server: {
    // App native charge la PWA en production (URL Vercel Biblos).
    url: "https://biblos.vercel.app",
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
  },
};

export default config;
