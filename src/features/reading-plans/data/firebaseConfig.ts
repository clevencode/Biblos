/**
 * Data — única fonte de credenciais Firebase (Vite env).
 * Não exportar o objeto config bruto para fora desta pasta.
 */

type FirebaseWebOptions = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

function cleanEnv(value: string | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function readOptions(): FirebaseWebOptions | null {
  const apiKey = cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY);
  const authDomain = cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
  const projectId = cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID);
  const appId = cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID);
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

export function isReadingPlansFirebaseConfigured(): boolean {
  return readOptions() != null;
}

/** Consumo interno (data layer apenas). */
export function getFirebaseWebOptionsForInit(): FirebaseWebOptions | null {
  return readOptions();
}
