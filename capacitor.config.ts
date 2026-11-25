import type { CapacitorConfig } from "@capacitor/cli";

/**
 * WebView APK: assets locais (sem server.url).
 * Auth + planos → Firebase JS SDK; Google no APK via plugin (idToken) + signInWithCredential.
 * skipNativeAuth: true — sessão só no JS SDK (evita dessincronia nativo/WebView).
 * APIs auxiliares → https://biblos-2sj1.vercel.app via apiUrl() + CapacitorHttp.
 */
const config: CapacitorConfig = {
  appId: "app.biblos.mobile",
  appName: "Biblos",
  webDir: "dist",
  server: {
    // OAuth / Firebase Auth + CDNs de streaming áudio (Anchor).
    allowNavigation: [
      "*.firebaseapp.com",
      "*.web.app",
      "*.googleapis.com",
      "*.gstatic.com",
      "*.google.com",
      "accounts.google.com",
      "*.googleusercontent.com",
      "*.firebaseio.com",
      "*.cloudfunctions.net",
      "biblos-2sj1.vercel.app",
      "*.vercel.app",
      // Podcast S21 / streaming
      "*.anchor.fm",
      "anchor.fm",
      "*.cloudfront.net",
      "*.spotifycdn.com",
      "*.spotify.com",
      "*.megaphone.fm",
      "*.podtrac.com",
      "*.buzzsprout.com",
      "*.libsyn.com",
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
      /* Mantém fundo sólido até hideAppSplash após 1.º paint do shell (anti-CLS). */
      launchShowDuration: 0,
      launchAutoHide: false,
      launchFadeOutDuration: 0,
      backgroundColor: "#0D1117",
      showSpinner: false,
    },
    FirebaseAuthentication: {
      // true = plugin só obtém idToken Google; sessão Firebase fica no JS SDK.
      skipNativeAuth: true,
      providers: ["google.com"],
    },
    // Capgo Media Session — default: FGS só com playbackState playing/paused.
  },
};

export default config;
