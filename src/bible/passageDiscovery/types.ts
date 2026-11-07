import type { BibleTestament } from "../../youversion/canon";
import type { ParsedPassage } from "../../youversion/usfm";

export type DiscoveryBookReason = "title" | "content";

export type DiscoveryBookHit = {
  id: string;
  title: string;
  testament: BibleTestament;
  reason: DiscoveryBookReason;
  count?: number;
};

export type DiscoveryJump = {
  passage: ParsedPassage;
  label: string;
};

export type PassageDiscoverySections = {
  at: DiscoveryBookHit[];
  nt: DiscoveryBookHit[];
};

export type PassageDiscoveryResult = {
  query: string;
  jumps: DiscoveryJump[];
  sections: PassageDiscoverySections;
  /** Erreur da pesquisa por conteúdo (título ainda pode ter resultados). */
  contentError: string | null;
};
