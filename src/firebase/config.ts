export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /** Optionnel — OAuth web client (login Google navigateur). */
  webClientId?: string;
};

/** E-mail Google de l’admin (remplace le nom seul pour id stable Notion). */
export const CLEVENCODE_ADMIN_EMAIL =
  (import.meta.env.VITE_CLEVENCODE_ADMIN_EMAIL as string | undefined)?.trim() || "";

export function readFirebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY ?? "").trim();
  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "").trim();
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "").trim();
  const storageBucket = String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "").trim();
  const messagingSenderId = String(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  ).trim();
  const appId = String(import.meta.env.VITE_FIREBASE_APP_ID ?? "").trim();
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  const webClientId = String(import.meta.env.VITE_FIREBASE_WEB_CLIENT_ID ?? "").trim();
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    ...(webClientId ? { webClientId } : {}),
  };
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseWebConfig() !== null;
}

/** Vérifie la config au boot (sans exposer les secrets). */
export function listMissingFirebaseEnvKeys(): string[] {
  const keys = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
  ] as const;
  return keys.filter((key) => !String(import.meta.env[key] ?? "").trim());
}
