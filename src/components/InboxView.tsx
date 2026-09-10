import { useEffect, useState } from "react";
import { useFlashcardSession } from "../flashcardSession";
import type { InboxCard } from "../types";
import { FlashcardReview, FlashDeckList } from "./FlashcardReview";

type InboxViewProps = {
  items: InboxCard[];
  active: boolean;
  /** Expanded (≥1280): lista | cartão. Medium/compact: lista↔cartão. */
  splitLayout?: boolean;
  /** Passage biblique → Lecture au lieu de la révision. */
  onOpenPassage?: (item: InboxCard) => void;
};

export function InboxView({ items, active, splitLayout = false, onOpenPassage }: InboxViewProps) {
  const [reviewing, setReviewing] = useState(false);
  const session = useFlashcardSession(items, {
    active,
    enableKeys: active && (splitLayout || reviewing),
    preserveOrder: true,
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
        <p className="inbox-empty-title">Inbox vazia</p>
        <p className="muted">Não há cartões com lembrete vencido.</p>
      </div>
    );
  }

  const openPassage = onOpenPassage
    ? (card: { id: string }) => {
        const item = items.find((entry) => entry.id === card.id);
        if (item) onOpenPassage(item);
      }
    : undefined;

  if (splitLayout) {
    return (
      <div className="flash-split">
        <FlashcardReview
          session={session}
          showRepetitionMeta
          allowGraduation={false}
          emptyMessage="Inbox vazia — não há cartões com lembrete vencido."
        />
        <div className="flash-list-pane flash-list-pane--side">
          <FlashDeckList
            session={session}
            title="Inbox"
            showWeekSchedule
            onPick={(index) => session.goTo(index)}
            onOpenPassage={openPassage}
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
          title="Inbox"
          showWeekSchedule
          onOpenPassage={openPassage}
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
      emptyMessage="Inbox vazia — não há cartões com lembrete vencido."
      onBackToList={() => setReviewing(false)}
    />
  );
}
