import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.biblos.mobile",
  appName: "Biblos",
  webDir: "dist",
  server: { url: "http://localhost:5174", cleartext: true },
  android: { allowMixedContent: true },
  plugins: { StatusBar: { style: "LIGHT", backgroundColor: "#FFFFFF", overlaysWebView: false } },
};
export default config;
