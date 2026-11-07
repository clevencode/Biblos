/** Version du document Firestore `users/{uid}/private/state`. */
export const USER_STATE_SCHEMA_VERSION = 2;

export function userPrivateStatePath(uid: string): string {
  return `users/${uid}/private/state`;
}
