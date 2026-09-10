import { useEffect, useState } from "react";
import { useFlashcardSession } from "../flashcardSession";
import { FlashcardReview, FlashDeckList } from "./FlashcardReview";
import type { Flashcard } from "../types";

type FlashcardDeckProps = {
  cards: Flashcard[];
  active: boolean;
  selectedId?: string | null;
  focusSeq?: number;
  /** Expanded (≥1280): lista | cartão. Medium/compact: lista↔cartão. */
  splitLayout?: boolean;
  onRemoveCard?: (card: Flashcard) => void;
  onReadChapter?: (card: Flashcard) => void;
};

export function FlashcardDeck({
  cards,
  active,
  selectedId = null,
  focusSeq = 0,
  splitLayout = false,
  onRemoveCard,
  onReadChapter,
}: FlashcardDeckProps) {
  const [reviewing, setReviewing] = useState(false);
  const session = useFlashcardSession(cards, {
    active,
    enableKeys: active && (splitLayout || reviewing),
    selectedId,
    focusSeq,
        includeEncerrado: true,
        allowGraduation: false,
  });

  useEffect(() => {
    if (!active) setReviewing(false);
  }, [active]);

  useEffect(() => {
    if (reviewing && !session.total) setReviewing(false);
  }, [reviewing, session.total]);

  useEffect(() => {
    if (selectedId && focusSeq > 0) setReviewing(true);
  }, [selectedId, focusSeq]);

  if (!session.total && !cards.length) {
    return (
      <div className="flash-empty-state">
        <p className="flash-empty-title">Aucune carte</p>
        <p className="muted">Lance npm run seed ou synchronise Notion.</p>
      </div>
    );
  }

  if (splitLayout) {
    return (
      <div className="flash-split">
        <FlashcardReview
          session={session}
          emptyMessage="Aucune carte à réviser."
          allowGraduation={false}
          onRemoveCard={onRemoveCard}
          onReadChapter={onReadChapter}
        />
        <div className="flash-list-pane flash-list-pane--side">
          <FlashDeckList session={session} onPick={(index) => session.goTo(index)} />
        </div>
      </div>
    );
  }

  if (!reviewing) {
    return (
      <div className="flash-list-pane">
        <FlashDeckList
          session={session}
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
      emptyMessage="Aucune carte à réviser."
      allowGraduation={false}
      onBackToList={() => setReviewing(false)}
      onRemoveCard={onRemoveCard}
      onReadChapter={onReadChapter}
    />
  );
}
