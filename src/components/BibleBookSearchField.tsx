import { useEffect, useRef } from "react";

type BibleBookSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  label: string;
  clearLabel: string;
  /** Foca o campo ao montar (ex.: aberto pelo botão de pesquisa da topbar). */
  autoFocus?: boolean;
  /**
   * Campo vazio: o botão vira "Annuler" e chama isto (sair do modo pesquisa).
   * Sem isto, o botão fica desactivado quando vazio.
   */
  onCancel?: () => void;
  cancelLabel?: string;
  className?: string;
};

/**
 * Campo de pesquisa de livros do seletor, na topbar (modo pesquisa aberto
 * pelo botão 🔍). Estilos em `.bible-yv-pick-book-search-*`.
 */
export function BibleBookSearchField({
  value,
  onChange,
  onClear,
  placeholder,
  label,
  clearLabel,
  autoFocus = false,
  onCancel,
  cancelLabel,
  className = "",
}: BibleBookSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const empty = !value.trim();
  const canCancel = empty && Boolean(onCancel);
  const actionLabel = canCancel ? (cancelLabel ?? clearLabel) : clearLabel;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div
      className={`bible-yv-pick-book-search-pill${className ? ` ${className}` : ""}`}
      role="search"
    >
      <input
        ref={inputRef}
        type="search"
        className="bible-yv-pick-book-search-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="bible-yv-pick-book-search-clear"
        onClick={canCancel ? onCancel : onClear}
        disabled={empty && !canCancel}
        aria-label={actionLabel}
      >
        {actionLabel}
      </button>
    </div>
  );
}
