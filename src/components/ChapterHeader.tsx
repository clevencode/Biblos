type ChapterHeaderProps = {
  /** Título principal — ex.: "Actes 1". */
  titulo: string;
  /** Rótulo do capítulo — ex.: "Chapitre 1"; caixa alta via CSS. */
  subtitulo: string;
  /** Tempo estimado — ex.: "4 min de lecture" (capitalização normal). */
  tempoLeitura?: string;
  className?: string;
};

/**
 * Cabeçalho editorial compacto do capítulo (linha única):
 * título serifado à esquerda · "CHAPITRE 1 • 4 min de lecture" à direita.
 * Em ecrã estreito quebra para título em cima e metadados por baixo.
 * Estilos em `.chapter-header*` (index.css).
 */
export function ChapterHeader({
  titulo,
  subtitulo,
  tempoLeitura,
  className = "",
}: ChapterHeaderProps) {
  return (
    <header className={`chapter-header${className ? ` ${className}` : ""}`}>
      <h1 className="chapter-header-title">{titulo}</h1>
      <p className="chapter-header-meta">
        <span className="chapter-header-kicker">{subtitulo}</span>
        {tempoLeitura ? (
          <>
            <span className="chapter-header-dot" aria-hidden>
              •
            </span>
            <span className="chapter-header-time">{tempoLeitura}</span>
          </>
        ) : null}
      </p>
    </header>
  );
}
