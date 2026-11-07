import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let adminApp = null;

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (!raw.trim()) return null;
  try {
    const json = JSON.parse(raw);
    if (json?.private_key && typeof json.private_key === "string") {
      json.private_key = json.private_key.replace(/\\n/g, "\n");
    }
    return json;
  } catch {
    return null;
  }
}

function getAdminApp() {
  if (adminApp) return adminApp;
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return null;
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    adminApp = admin.app();
  }
  return adminApp;
}

/**
 * Vérifie le JWT Firebase (Authorization: Bearer).
 * Retourne { uid, email } ou null si invalide / absent.
 * Sans FIREBASE_SERVICE_ACCOUNT_JSON : validation désactivée (retourne null).
 */
export async function verifyFirebaseAuthHeader(authHeader) {
  const header = String(authHeader || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const idToken = header.slice(7).trim();
  if (!idToken) return null;

  const app = getAdminApp();
  if (!app) {
    return { verificationSkipped: true, uid: null, email: null };
  }

  const admin = require("firebase-admin");
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return {
      verificationSkipped: false,
      uid: decoded.uid,
      email: decoded.email || null,
    };
  } catch {
    return { verificationSkipped: false, uid: null, email: null, invalid: true };
  }
}

export function firebaseAdminConfigured() {
  return Boolean(parseServiceAccount());
}
