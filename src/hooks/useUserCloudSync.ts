import { useEffect, useRef } from "react";
import { subscribeFlashcardRevision } from "../cardOverrides";
import { subscribePlanProgressRevision } from "../planProgress";
import { runUserCloudSync } from "../firebase/syncSession";
import { isProfileOnboarded, type UserProfile } from "../userProfile";

const PUSH_DEBOUNCE_MS = 4_000;
const PERIODIC_PUSH_MS = 3 * 60_000;

/**
 * Sync Firebase métier : pull au login, push debouncé sur progression / cartes.
 */
export function useUserCloudSync(profile: UserProfile): void {
  const pushTimer = useRef<number | null>(null);
  const onboarded = isProfileOnboarded(profile);

  useEffect(() => {
    if (!onboarded || !profile.firebaseUid) return;

    void runUserCloudSync({ push: true, pull: true, presence: "Online" });

    const periodic = window.setInterval(() => {
      void runUserCloudSync({ push: true, pull: false, presence: "Online" });
    }, PERIODIC_PUSH_MS);

    const onOnline = () => {
      void runUserCloudSync({ push: true, pull: true, presence: "Online" });
    };
    window.addEventListener("online", onOnline);

    return () => {
      window.clearInterval(periodic);
      window.removeEventListener("online", onOnline);
      void runUserCloudSync({ push: true, pull: false, presence: "Offline" });
    };
  }, [onboarded, profile.firebaseUid]);

  useEffect(() => {
    if (!onboarded || !profile.firebaseUid) return undefined;

    function schedulePush() {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => {
        pushTimer.current = null;
        void runUserCloudSync({ push: true, pull: false });
      }, PUSH_DEBOUNCE_MS);
    }

    const stopCards = subscribeFlashcardRevision(schedulePush);
    const stopPlans = subscribePlanProgressRevision(schedulePush);
    return () => {
      stopCards();
      stopPlans();
      if (pushTimer.current) {
        window.clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
    };
  }, [onboarded, profile.firebaseUid]);
}
