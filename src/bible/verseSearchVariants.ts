/**
 * Formas da mesma palavra para a pesquisa (flexão), por geração a partir do
 * termo pesquisado e validação contra o vocabulário do próprio índice.
 *
 * Porquê gerar e não « cortar sufixos » de todas as palavras: com o texto
 * normalizado sem acentos, um stemmer agressivo junta palavras distintas
 * (mer/mère, foi/fois, devant/devez). Gerar formas a partir do termo e
 * exigir que existam no texto mantém a precisão de uma concordância.
 */

/** Terminações do presente/imperfeito/futuro/particípio dos verbos em -er. */
const ER_VERB_ENDINGS = [
  "er",
  "e",
  "es",
  "ent",
  "ons",
  "ez",
  "ais",
  "ait",
  "ions",
  "iez",
  "aient",
  "a",
  "ai",
  "as",
  "ames",
  "ates",
  "erent",
  "erai",
  "eras",
  "era",
  "erons",
  "erez",
  "eront",
  "erais",
  "erait",
  "erions",
  "eriez",
  "eraient",
  "ee",
  "ees",
  "ant",
] as const;

/** Terminações (mais longas primeiro) para reconhecer um verbo conjugado. */
const ER_VERB_ENDINGS_BY_LENGTH = [...ER_VERB_ENDINGS].sort(
  (a, b) => b.length - a.length,
);

/** Mínimo de letras do radical verbal (aim-er, pri-er…). */
const MIN_VERB_BASE = 3;

/** Formas que só um verbo tem (provam que o radical é verbal). */
const VERB_ONLY_ENDINGS = ["ait", "aient", "ez"] as const;

/**
 * Radical de um verbo em -er a partir de qualquer forma, só com prova no
 * vocabulário:
 * - o infinitivo existe (« aimait » → « aim » porque « aimer » existe;
 *   « serpent » não, porque « serper » não existe); ou
 * - o termo pesquisado é ele próprio um infinitivo em -er e existe uma
 *   forma só verbal (« aimer » + « aimait »; « berger » não: « bergait »).
 */
function erVerbBase(token: string, has: (w: string) => boolean): string | null {
  for (const ending of ER_VERB_ENDINGS_BY_LENGTH) {
    if (!token.endsWith(ending)) continue;
    const base = token.slice(0, token.length - ending.length);
    if (base.length < MIN_VERB_BASE) continue;
    if (has(`${base}er`)) return base;
    if (ending === "er" && VERB_ONLY_ENDINGS.some((e) => has(`${base}${e}`))) {
      return base;
    }
  }
  return null;
}

/**
 * Formas de um termo francês (já normalizado: minúsculas, sem acentos)
 * presentes no vocabulário — sem o próprio termo.
 */
export function frenchInflections(
  token: string,
  has: (w: string) => boolean,
): string[] {
  const t = String(token || "");
  /* 1–3 letras: só a forma exata (foi ≠ fois, mer ≠ mère, roi…). */
  if (t.length < 4) return [];
  const out = new Set<string>();
  const add = (w: string) => {
    if (w && w !== t && has(w)) out.add(w);
  };

  /* Nome/adjetivo: plural e feminino. */
  const singulars = new Set<string>([t]);
  if (t.length >= 5 && /[sx]$/.test(t) && has(t.slice(0, -1))) {
    singulars.add(t.slice(0, -1));
  }
  if (t.length >= 6 && t.endsWith("elle") && has(t.slice(0, -2))) {
    singulars.add(t.slice(0, -2)); /* eternelle → eternel */
  }
  if (t.length >= 6 && t.endsWith("e") && has(t.slice(0, -1))) {
    singulars.add(t.slice(0, -1)); /* sainte → saint */
  }
  for (const base of singulars) {
    add(base);
    add(`${base}s`);
    if (/(eu|au|ou)$/.test(base)) add(`${base}x`);
    if (base.length >= 5 && !base.endsWith("e")) {
      add(`${base}e`);
      add(`${base}es`);
    }
    if (base.length >= 5 && base.endsWith("el")) {
      add(`${base}le`);
      add(`${base}les`);
    }
  }

  /* Verbo em -er: todas as formas conhecidas do mesmo radical. */
  const verbBase = erVerbBase(t, has);
  if (verbBase) {
    for (const ending of ER_VERB_ENDINGS) add(`${verbBase}${ending}`);
  }

  return [...out];
}

/** Créole haitiano: sem flexão (plural por « yo », tempos por partículas). */
export function noInflections(): string[] {
  return [];
}
