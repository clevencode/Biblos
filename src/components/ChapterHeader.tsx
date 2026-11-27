type ChapterHeaderProps = {
  /** Sobretítulo (kicker) — ex.: "Chapitre 4"; renderizado em caixa alta via CSS. */
  subtitulo: string;
  /** Título principal — ex.: "Jean 4". */
  titulo: string;
  /** Linha discreta sob o título — ex.: "4 min de lecture". */
  meta?: string;
  className?: string;
};

/**
 * Cabeçalho editorial centralizado do capítulo: kicker + título serifado
 * (+ meta opcional, ex. tempo de leitura) + filete.
 * Estilos em `.chapter-header*` (index.css).
 */
export function ChapterHeader({
  subtitulo,
  titulo,
  meta,
  className = "",
}: ChapterHeaderProps) {
  return (
    <header className={`chapter-header${className ? ` ${className}` : ""}`}>
      <p className="chapter-header-kicker">{subtitulo}</p>
      <h1 className="chapter-header-title">{titulo}</h1>
      {meta ? <p className="chapter-header-meta">{meta}</p> : null}
      <hr className="chapter-header-rule" aria-hidden />
    </header>
  );
}
