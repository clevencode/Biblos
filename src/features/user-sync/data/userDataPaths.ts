/** Paths Firestore — dados pessoais apenas (nunca textos bíblicos). */

export function userHighlightsDoc(uid: string) {
  return `users/${uid}/highlights/state`;
}

export function userNotesDoc(uid: string) {
  return `users/${uid}/notes/state`;
}

export function userPlanProgressDoc(uid: string) {
  return `users/${uid}/planProgress/state`;
}
