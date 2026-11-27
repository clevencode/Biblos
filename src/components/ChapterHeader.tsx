type ChapterHeaderProps = {
  /** Sobretítulo (kicker) — ex.: "Chapitre 4"; renderizado em caixa alta via CSS. */
  subtitulo: string;
  /** Título principal — ex.: "Jean 4". */
  titulo: string;
  className?: string;
};

/**
 * Cabeçalho editorial centralizado do capítulo: kicker + título serifado + filete.
 * Estilos em `.chapter-header*` (index.css).
 */
export function ChapterHeader({
  subtitulo,
  titulo,
  className = "",
}: ChapterHeaderProps) {
  return (
    <header className={`chapter-header${className ? ` ${className}` : ""}`}>
      <p className="chapter-header-kicker">{subtitulo}</p>
      <h1 className="chapter-header-title">{titulo}</h1>
      <hr className="chapter-header-rule" aria-hidden />
    </header>
  );
}
