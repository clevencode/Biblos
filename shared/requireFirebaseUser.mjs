import { verifyFirebaseAuthHeader, firebaseAdminConfigured } from "./firebaseAdmin.mjs";
import { CLEVENCODE_ADMIN_USER_ID } from "./notion.mjs";

/**
 * Valide l’appelant Firebase pour les routes sensibles.
 * - Sans compte de service : laisse passer (mode dev).
 * - Avec compte de service : exige Bearer valide et aligne localId/userId.
 */
export async function assertFirebaseCaller(req, body, options = {}) {
  const auth = await verifyFirebaseAuthHeader(
    req.headers?.authorization || req.headers?.Authorization,
  );

  if (!auth) {
    if (firebaseAdminConfigured()) {
      return { ok: false, status: 401, error: "Connexion requise" };
    }
    return { ok: true, uid: null, verificationSkipped: true };
  }

  if (auth.invalid) {
    return { ok: false, status: 401, error: "Jeton Firebase invalide" };
  }

  if (auth.verificationSkipped) {
    return { ok: true, uid: null, verificationSkipped: true };
  }

  const uid = auth.uid;
  const localId = String(body.localId || body.id || "").trim();
  const userId = String(body.userId || "").trim();

  if (options.requireLocalIdMatch && localId && localId !== uid) {
    const adminId = CLEVENCODE_ADMIN_USER_ID;
    if (localId !== adminId) {
      return { ok: false, status: 403, error: "localId ne correspond pas au compte" };
    }
  }

  if (options.requireUserIdMatch && userId && userId !== uid) {
    const adminId = CLEVENCODE_ADMIN_USER_ID;
    if (userId !== adminId) {
      return { ok: false, status: 403, error: "userId ne correspond pas au compte" };
    }
  }

  return { ok: true, uid, email: auth.email, verificationSkipped: false };
}
