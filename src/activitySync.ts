/**
 * Sync activité → Firestore.
 */
import type { ActivityEvent } from "./activityLog";
import {
  flushActivityOutboxToCloud,
  pullActivityFromCloud as pullActivityFromFirestore,
  scheduleActivityCloudSync,
} from "./firebase/activityCloud";

export type ActivitySyncResult = {
  ok: boolean;
  error?: string;
  queued?: boolean;
};

export function enqueueActivityEvent(event: ActivityEvent): void {
  scheduleActivityCloudSync(event);
}

export async function flushActivityOutbox(): Promise<{
  sent: number;
  remaining: number;
}> {
  return flushActivityOutboxToCloud();
}

export async function pullActivityFromCloud(): Promise<{
  ok: boolean;
  merged: number;
  error?: string;
}> {
  return pullActivityFromFirestore();
}

export async function syncUserActivityAcrossDevices(): Promise<void> {
  await flushActivityOutbox();
  await pullActivityFromCloud();
}

export function scheduleActivitySync(event: ActivityEvent | null): void {
  scheduleActivityCloudSync(event);
}

export async function pushActivityEvent(
  event: ActivityEvent,
): Promise<ActivitySyncResult> {
  scheduleActivityCloudSync(event);
  const flush = await flushActivityOutboxToCloud();
  return {
    ok: true,
    queued: flush.remaining > 0,
  };
}

export function countActivityOutbox(): number {
  try {
    const raw = localStorage.getItem("biblos-activity-outbox-v1");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
