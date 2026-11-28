/**
 * Mapear a passagem atual ao trocar de versão (S21 ↔ HT98).
 *
 * Diferenças reais entre as duas versões (medidas nos dados):
 * - 12 livros só existem na HT98 (deuterocanônicos);
 * - Joel e Malaquias têm divisão de capítulos diferente:
 *     S21 Joël 3:1–5   = HT98 Jowèl 2:28–32
 *     S21 Joël 4       = HT98 Jowèl 3
 *     S21 Malachie 3:19–24 = HT98 Malachi 4:1–6
 * - noutros capítulos o nº de versículos varia (o versículo é limitado ao fim).
 */

import type { BibleTextVersionId } from "./bibleVersions";

export type VersionPassage = {
  bookId: string;
  chapter: number;
  /** Versículo a manter no topo; null = início do capítulo. */
  verse: number | null;
};

export type VersionBookInfo = { id: string; chapterCount: number };

export type VersionMapNote = "book_substituted" | "chapter_clamped" | null;

export type VersionMapResult = VersionPassage & { note: VersionMapNote };

/** Deuterocanônicos com equivalente direto no cânon protestante. */
const DC_EQUIVALENT: Readonly<Record<string, string>> = {
  ESG: "EST",
  DAG: "DAN",
  SUS: "DAN",
  BEL: "DAN",
};

/** Ajustes de versificação S21 → HT98 (capítulo, versículo). */
function s21ToHt98(bookId: string, chapter: number, verse: number | null): VersionPassage {
  if (bookId === "JOL" && chapter === 3) {
    return { bookId, chapter: 2, verse: (verse ?? 1) + 27 };
  }
  if (bookId === "JOL" && chapter === 4) return { bookId, chapter: 3, verse };
  if (bookId === "MAL" && chapter === 3 && verse != null && verse >= 19) {
    return { bookId, chapter: 4, verse: verse - 18 };
  }
  return { bookId, chapter, verse };
}

/** Ajustes de versificação HT98 → S21. */
function ht98ToS21(bookId: string, chapter: number, verse: number | null): VersionPassage {
  if (bookId === "JOL" && chapter === 2 && verse != null && verse >= 28) {
    return { bookId, chapter: 3, verse: verse - 27 };
  }
  if (bookId === "JOL" && chapter === 3) return { bookId, chapter: 4, verse };
  if (bookId === "MAL" && chapter === 4) {
    return { bookId, chapter: 3, verse: (verse ?? 1) + 18 };
  }
  return { bookId, chapter, verse };
}

/**
 * Livro equivalente na versão de destino. Sem equivalente direto, o próximo
 * livro (na ordem da versão de origem) que existe no destino — o leitor
 * continua "em frente" no cânon (ex.: Tobi → Ester, Sirak → Ezayi).
 */
function resolveTargetBook(
  bookId: string,
  sourceOrder: readonly string[],
  target: ReadonlyMap<string, VersionBookInfo>,
): { bookId: string; substituted: boolean } | null {
  if (target.has(bookId)) return { bookId, substituted: false };
  const direct = DC_EQUIVALENT[bookId];
  if (direct && target.has(direct)) return { bookId: direct, substituted: true };
  const from = sourceOrder.indexOf(bookId);
  for (let i = from + 1; from >= 0 && i < sourceOrder.length; i++) {
    if (target.has(sourceOrder[i]!)) return { bookId: sourceOrder[i]!, substituted: true };
  }
  for (let i = from - 1; i >= 0; i--) {
    if (target.has(sourceOrder[i]!)) return { bookId: sourceOrder[i]!, substituted: true };
  }
  return null;
}

export function mapPassageBetweenVersions(input: {
  from: BibleTextVersionId;
  to: BibleTextVersionId;
  passage: VersionPassage;
  /** Ordem dos livros na versão de origem (para escolher o livro seguinte). */
  sourceBookOrder: readonly string[];
  targetBooks: readonly VersionBookInfo[];
}): VersionMapResult {
  const { from, to, passage, sourceBookOrder, targetBooks } = input;
  const bookId = passage.bookId.toUpperCase();
  const chapter = Math.max(1, Math.floor(passage.chapter) || 1);
  const verse = passage.verse != null && passage.verse > 0 ? passage.verse : null;
  const target = new Map(targetBooks.map((b) => [b.id.toUpperCase(), b]));

  if (from === to || target.size === 0) {
    return { bookId, chapter, verse, note: null };
  }

  const resolved = resolveTargetBook(
    bookId,
    sourceBookOrder.map((id) => id.toUpperCase()),
    target,
  );
  if (!resolved) return { bookId: targetBooks[0]!.id.toUpperCase(), chapter: 1, verse: null, note: "book_substituted" };
  if (resolved.substituted) {
    // Livro trocado: a posição dentro dele não corresponde — início do livro,
    // exceto equivalentes diretos (Ester grega → Ester, mesmo capítulo).
    const keepChapter = DC_EQUIVALENT[bookId] === resolved.bookId && bookId === "ESG";
    const info = target.get(resolved.bookId)!;
    return {
      bookId: resolved.bookId,
      chapter: keepChapter ? Math.min(chapter, info.chapterCount) : 1,
      verse: null,
      note: "book_substituted",
    };
  }

  const shifted =
    from === "s21" && to === "ht98"
      ? s21ToHt98(bookId, chapter, verse)
      : from === "ht98" && to === "s21"
        ? ht98ToS21(bookId, chapter, verse)
        : { bookId, chapter, verse };

  const info = target.get(bookId)!;
  if (info.chapterCount > 0 && shifted.chapter > info.chapterCount) {
    return { bookId, chapter: info.chapterCount, verse: null, note: "chapter_clamped" };
  }
  return { ...shifted, note: null };
}
