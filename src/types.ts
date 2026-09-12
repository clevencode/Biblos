export type RetentionMark = "encore" | "facil" | "medio" | "dificil";
export type CardCategory = "VERSECARD" | "ENSEIGNEMENT";

export type Materia = {
  id: string;
  nome: string;
};

export type Flashcard = {
  id: string;
  frente: string;
  verso: string;
  categoria: RetentionMark | null;
  status: "estudo" | "espera" | "encerrado";
  url: string;
  lembrete?: string | null;
  cardCategory?: CardCategory | string | null;
  /** Surligneur YouVersion (hex), ex. #2563eb. */
  color?: string | null;
  connaissance?: string | null;
  formationNome?: string | null;
  materiaNome?: string;
  criadoEm?: string | null;
  revisadoEm?: string | null;
};

export type PlanDay = { jour: number; texte: string; defi: string };
export type ReadingPlan = {
  id: string;
  nome: string;
  theme: string;
  url: string;
  days: PlanDay[];
  /** Propriedade Notion `Devotional` (ex-Description / comme Resumo no StudyOS). */
  description?: string;
  cardIds?: string[];
  criadoEm?: string | null;
};

/** Wrapper pour réutiliser merge/outbox flashcards. */
export type Seed = {
  nota: { id: string; titulo: string; url: string; criadoEm: string; cartoes?: number };
  materia: Materia;
  disciplina: { id: string; nome: string };
  flashcards: Flashcard[];
};

export type Catalog = { notas: Seed[]; plans: ReadingPlan[] };
export type CenterMode = "today" | "bible" | "cards" | "inbox" | "profile";
export type InboxCard = Flashcard & {
  noteId: string;
  disciplinaNome: string;
  materiaNome: string;
};
