/** Identifiant de texte biblique supporté par l’app (HT98 + S21). */
export type BibleProductScope = "s21" | "ht98";

/** Vestige minimal — création locale de carte verset (désactivée dans l’UI). */
export type Flashcard = {
  id: string;
  frente: string;
  verso: string;
  color?: string | null;
  cardCategory?: string | null;
  status?: string;
  url?: string;
  lembrete?: string | null;
  categoria?: string | null;
  criadoEm?: string | null;
};
