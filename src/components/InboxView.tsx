import { useEffect, useMemo, useState } from "react";
import { formatDay } from "../calendar";
import { useFlashcardSession } from "../flashcardSession";
import { inboxBucket, inboxDisplayOrder, lastReviewedOn, type InboxBucket } from "../retention";
import { isPassageReminder } from "../passageReminder";
import type { InboxCard } from "../types";
import { FlashcardReview } from "./FlashcardReview";

type InboxViewProps = {
  items: InboxCard[];
  active: boolean;
  /** Expanded (≥1280): lista | cartão. Medium/compact: lista↔cartão. */
  splitLayout?: boolean;
  /** Passage (VERSECARD) → Lecture Bible au lieu de la révision. */
  onOpenPassage?: (item: InboxCard) => void;
};

const BUCKET_LABELS: Record<InboxBucket, string> = {
  overdue: "En retard",
  today: "Aujourd’hui",
  nodate: "Sans date",
};

const BUCKET_ORDER: InboxBucket[] = ["overdue", "today", "nodate"];

type SectionSnapshot = {
  numberById: Map<string, number>;
  totalByBucket: Record<InboxBucket, number>;
};

function buildSectionSnapshot(items: InboxCard[]): SectionSnapshot {
  const numberById = new Map<string, number>();
  const totalByBucket: Record<InboxBucket, number> = { overdue: 0, today: 0, nodate: 0 };
  const buckets: Record<InboxBucket, InboxCard[]> = { overdue: [], today: [], nodate: [] };
  for (const item of items) buckets[inboxBucket(item.lembrete)].push(item);
  for (const key of BUCKET_ORDER) {
    const group = buckets[key];
    totalByBucket[key] = group.length;
    group.forEach((item, i) => numberById.set(item.id, i + 1));
  }
  return { numberById, totalByBucket };
}

type InboxReviewListProps = {
  items: InboxCard[];
  activeId: string | null;
  listRef: React.RefObject<HTMLElement | null>;
  numberById: Map<string, number>;
  onPick: (id: string) => void;
  onOpenPassage?: (item: InboxCard) => void;
};

function InboxReviewList({
  items,
  activeId,
  listRef,
  numberById,
  onPick,
  onOpenPassage,
}: InboxReviewListProps) {
  const groups = useMemo(() => {
    const buckets: Record<InboxBucket, InboxCard[]> = { overdue: [], today: [], nodate: [] };
    for (const item of items) buckets[inboxBucket(item.lembrete)].push(item);
    return BUCKET_ORDER.filter((key) => buckets[key].length).map((key) => ({
      key,
      items: buckets[key],
    }));
  }, [items]);

  return (
    <nav className="flash-list flash-list--inbox" ref={listRef} aria-label="Inbox">
      <header className="inbox-head">
        <p className="session-kicker">Révision</p>
        <h2>Inbox</h2>
        <p>
          {items.length} carte{items.length === 1 ? "" : "s"} à revoir
          {items.length ? " · choisis pour réviser" : ""}
        </p>
      </header>
      <div className="inbox-scroller">
        {groups.map((group) => (
          <section key={group.key} className="inbox-group">
            <h3 className="inbox-group-label">{BUCKET_LABELS[group.key]}</h3>
            <ol className="inbox-list">
              {group.items.map((item) => {
                const num = numberById.get(item.id) ?? 0;
                const activeItem = item.id === activeId;
                const last = lastReviewedOn(item);
                const passage = isPassageReminder(item.frente, item.cardCategory);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`inbox-item${activeItem ? " is-active" : ""}${passage ? " is-passage" : ""}`}
                      onClick={() => {
                        if (passage && onOpenPassage) {
                          onOpenPassage(item);
                          return;
                        }
                        onPick(item.id);
                      }}
                      aria-current={activeItem ? "true" : undefined}
                      aria-label={
                        passage ? `Lire le passage: ${item.frente}` : `Réviser la carte: ${item.frente}`
                      }
                    >
                      <span className="inbox-item-num">{num}</span>
                      <span className="inbox-item-body">
                        <span className="inbox-item-title">{item.frente}</span>
                        <span className="inbox-item-meta">
                          <span className="inbox-item-disciplina">{item.disciplinaNome}</span>
                          <span className="inbox-item-materia">{item.materiaNome}</span>
                          {last ? (
                            <time className="inbox-item-reviewed" dateTime={last} title="Última revisão">
                              Rev. {formatDay(last)}
                            </time>
                          ) : null}
                          {item.lembrete ? (
                            <time
                              className={group.key === "overdue" ? "is-late" : undefined}
                              dateTime={item.lembrete}
                              title="Rappel"
                            >
                              {formatDay(item.lembrete)}
                            </time>
                          ) : (
                            <span>Sans rappel</span>
                          )}
                        </span>
                      </span>
                      <span className="inbox-item-action" aria-hidden="true">
                        {passage ? "Lire" : "Rever"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </nav>
  );
}

export function InboxView({ items, active, splitLayout = false, onOpenPassage }: InboxViewProps) {
  const [reviewing, setReviewing] = useState(false);
  const [snapshot, setSnapshot] = useState<SectionSnapshot | null>(null);
  const orderedItems = useMemo(() => inboxDisplayOrder(items), [items]);
  const session = useFlashcardSession(orderedItems, {
    active,
    enableKeys: active && (splitLayout || reviewing),
    preserveOrder: true,
  });
  const listItems = session.queue as InboxCard[];

  const listSnapshot = useMemo(() => buildSectionSnapshot(listItems), [listItems]);

  const activeSnapshot = splitLayout ? listSnapshot : snapshot;

  const reviewNumbering = useMemo(() => {
    const card = session.card as InboxCard | null;
    const cardId = card?.id;
    if (!card || !cardId || !activeSnapshot) return undefined;
    const bucket = inboxBucket(card.lembrete);
    const position = activeSnapshot.numberById.get(cardId);
    const total = activeSnapshot.totalByBucket[bucket];
    if (!position || !total) return undefined;
    return {
      position,
      total,
      section: BUCKET_LABELS[bucket],
    };
  }, [activeSnapshot, session.card, session.card?.id, session.index]);

  useEffect(() => {
    if (!active) {
      setReviewing(false);
      setSnapshot(null);
    }
  }, [active]);

  useEffect(() => {
    if (reviewing && !session.total) {
      setReviewing(false);
      setSnapshot(null);
    }
  }, [reviewing, session.total]);

  if (!session.total) {
    return (
      <div className="inbox-view inbox-empty">
        <p className="session-kicker">Révision</p>
        <p className="inbox-empty-title">Inbox vazia</p>
        <p className="muted">Não há cartões com lembrete vencido.</p>
      </div>
    );
  }

  if (splitLayout) {
    return (
      <div className="flash-split">
        <FlashcardReview
          session={session}
          showRepetitionMeta
          allowGraduation
          numbering={reviewNumbering}
          emptyMessage="Inbox vazia — não há cartões com lembrete vencido."
        />
        <div className="flash-list-pane flash-list-pane--side">
          <InboxReviewList
            items={listItems}
            activeId={session.card?.id ?? null}
            listRef={session.listRef}
            numberById={listSnapshot.numberById}
            onPick={(id) => session.goToId(id)}
            onOpenPassage={onOpenPassage}
          />
        </div>
      </div>
    );
  }

  if (!reviewing) {
    return (
      <div className="inbox-view">
        <InboxReviewList
          items={listItems}
          activeId={session.card?.id ?? null}
          listRef={session.listRef}
          numberById={listSnapshot.numberById}
          onOpenPassage={onOpenPassage}
          onPick={(id) => {
            setSnapshot(buildSectionSnapshot(listItems));
            session.goToId(id);
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
      allowGraduation
      numbering={reviewNumbering}
      emptyMessage="Inbox vazia — não há cartões com lembrete vencido."
      onBackToList={() => {
        setReviewing(false);
        setSnapshot(null);
      }}
    />
  );
}
