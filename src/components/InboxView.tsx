import { useEffect, useState } from "react";
import { useFlashcardSession } from "../flashcardSession";
import type { InboxCard } from "../types";
import { FlashcardReview, FlashDeckList } from "./FlashcardReview";

type InboxViewProps = {
  items: InboxCard[];
  active: boolean;
  /** Expanded (≥1280): lista | cartão. Medium/compact: lista↔cartão. */
  splitLayout?: boolean;
  onReadChapter?: (card: InboxCard) => void;
};

/**
 * Timeline: agenda hebdomadaire des rappels.
 * Un clic ouvre la révision de la carte (pas Lecture).
 */
export function InboxView({ items, active, splitLayout = false, onReadChapter }: InboxViewProps) {
  const [reviewing, setReviewing] = useState(false);
  const session = useFlashcardSession(items, {
    active,
    enableKeys: active && (splitLayout || reviewing),
    preserveOrder: true,
    dropAfterMark: false,
    dayScope: true,
    allowGraduation: false,
  });

  useEffect(() => {
    if (!active) setReviewing(false);
  }, [active]);

  useEffect(() => {
    if (reviewing && !session.total) setReviewing(false);
  }, [reviewing, session.total]);

  if (!session.total) {
    return (
      <div className="inbox-view inbox-empty">
        <p className="inbox-empty-title">Timeline vide</p>
        <p className="muted">Aucun rappel planifié pour le moment.</p>
      </div>
    );
  }

  if (splitLayout) {
    return (
      <div className="flash-split">
        <FlashcardReview
          session={session}
          showRepetitionMeta
          allowGraduation={false}
          emptyMessage="Timeline vide — aucun rappel planifié."
          onReadChapter={onReadChapter}
        />
        <div className="flash-list-pane flash-list-pane--side">
          <FlashDeckList
            session={session}
            title="Timeline"
            showWeekSchedule
            onPick={(index) => session.goTo(index)}
          />
        </div>
      </div>
    );
  }

  if (!reviewing) {
    return (
      <div className="flash-list-pane">
        <FlashDeckList
          session={session}
          title="Timeline"
          showWeekSchedule
          onPick={(index) => {
            session.goTo(index);
            setReviewing(true);
          }}
        />
      </div>
    );
  }

  return (
    <FlashcardReview
      session={session}
      showRepetitionMeta
      allowGraduation={false}
      emptyMessage="Timeline vide — aucun rappel planifié."
      onBackToList={() => setReviewing(false)}
      onReadChapter={onReadChapter}
    />
  );
}
