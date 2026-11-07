/**
 * Point d’entrée unique pour sync Firebase (bonne pratique : une session, push puis pull).
 */
import { flushAdminMessageOutbox } from "../adminMessage";
import { flushActivityOutbox, pullActivityFromCloud } from "../activitySync";
import { pullUserProfileFromCloud } from "./profileCloud";
import { syncUserProfileToCloud } from "../userProfileSync";
import type { PresenceStatus } from "../userProfileSync";
import { pullUserStateFromCloud, pushUserStateToCloud } from "./userStateCloud";

export type UserCloudSyncResult = {
  ok: boolean;
  profile?: boolean;
  state?: boolean;
  activity?: boolean;
  messages?: boolean;
  errors: string[];
};

export async function runUserCloudSync(options?: {
  presence?: PresenceStatus;
  push?: boolean;
  pull?: boolean;
}): Promise<UserCloudSyncResult> {
  const push = options?.push !== false;
  const pull = options?.pull !== false;
  const errors: string[] = [];
  let profile = false;
  let state = false;
  let activity = false;
  let messages = false;

  if (push) {
    const profileResult = await syncUserProfileToCloud(undefined, {
      presence: options?.presence ?? "Online",
    });
    profile = Boolean(profileResult.ok);
    if (profileResult.error && !profileResult.skipped) {
      errors.push(profileResult.error);
    }

    const stateResult = await pushUserStateToCloud();
    state = stateResult.ok;
    if (stateResult.error) errors.push(stateResult.error);

    const act = await flushActivityOutbox();
    activity = act.sent > 0 || act.remaining === 0;
    const msg = await flushAdminMessageOutbox();
    messages = msg.sent > 0 || msg.remaining === 0;
  }

  if (pull) {
    const pullProfile = await pullUserProfileFromCloud();
    if (pullProfile.error) errors.push(pullProfile.error);
    const pullState = await pullUserStateFromCloud();
    if (pullState.error) errors.push(pullState.error);
    const pullAct = await pullActivityFromCloud();
    if (pullAct.error) errors.push(pullAct.error);
    if (pullState.applied) state = true;
    if (pullAct.merged > 0) activity = true;
  }

  return {
    ok: errors.length === 0,
    profile,
    state,
    activity,
    messages,
    errors,
  };
}
