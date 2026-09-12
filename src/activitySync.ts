/**
 * Sync activité locale → Notion (outbox idempotente par LocalId).
 */
import type { ActivityEvent } from "./activityLog";

const OUTBOX_KEY = "biblos-activity-notion-outbox";

function loadOutbox(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ActivityEvent[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: ActivityEvent[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export function enqueueActivityNotionSync(event: ActivityEvent) {
  const next = [...loadOutbox().filter((item) => item.id !== event.id), event];
  writeOutbox(next);
}

export function listActivityNotionOutbox(): ActivityEvent[] {
  return loadOutbox();
}

export type ActivityPushResult = {
  pushed: number;
  remaining: number;
  error?: string;
};

export async function flushActivityNotionSync(): Promise<ActivityPushResult> {
  const pending = loadOutbox();
  if (!pending.length) return { pushed: 0, remaining: 0 };

  let pushed = 0;
  let error: string | undefined;
  const remaining: ActivityEvent[] = [];

  for (const event of pending) {
    try {
      const response = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localId: event.id,
          userId: event.userId,
          type: event.type,
          at: event.at,
          meta: event.meta ?? null,
          displayName: event.type,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        hasToken?: boolean;
        skipped?: boolean;
      };
      if (!data.ok) {
        if (data.hasToken === false) {
          remaining.push(...pending.slice(pending.indexOf(event)));
          error = data.error || "NOTION_TOKEN em falta";
          break;
        }
        remaining.push(event);
        error = data.error || "sync activité échoué";
        continue;
      }
      pushed += 1;
    } catch (err) {
      remaining.push(event);
      error = err instanceof Error ? err.message : "réseau";
    }
  }

  writeOutbox(remaining);
  return { pushed, remaining: remaining.length, error };
}
