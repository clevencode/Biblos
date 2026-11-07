/**
 * Messages d’aide → Firestore (file locale hors ligne).
 */
import {
  flushSupportOutboxToCloud,
  sendSupportMessageToCloud,
} from "./firebase/supportCloud";
import type { UserProfile } from "./userProfile";

export type AdminMessageCategoryId =
  | "bug"
  | "suggestion"
  | "complaint"
  | "question"
  | "other";

export type AdminMessageCategory = {
  id: AdminMessageCategoryId;
  label: string;
};

export const ADMIN_MESSAGE_CATEGORIES: readonly AdminMessageCategory[] = [
  { id: "bug", label: "Bug" },
  { id: "suggestion", label: "Suggestion" },
  { id: "complaint", label: "Réclamation" },
  { id: "question", label: "Question" },
  { id: "other", label: "Autre" },
] as const;

export function adminMessageCategoryLabel(
  id: string | null | undefined,
): string | null {
  const hit = ADMIN_MESSAGE_CATEGORIES.find((item) => item.id === id);
  return hit?.label ?? null;
}

export type AdminMessageResult = {
  ok: boolean;
  error?: string;
  url?: string;
  queued?: boolean;
};

const OUTBOX_KEY = "biblos-admin-message-outbox-v1";

export function countAdminMessageOutbox(): number {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export async function flushAdminMessageOutbox(): Promise<{
  sent: number;
  remaining: number;
}> {
  return flushSupportOutboxToCloud();
}

export async function sendAdminMessage(
  profile: UserProfile,
  input: { category: AdminMessageCategoryId; body: string },
): Promise<AdminMessageResult> {
  return sendSupportMessageToCloud(profile, input);
}
