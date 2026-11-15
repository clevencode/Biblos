/**
 * Teclado mobile: marca `html[data-keyboard="open"]` + `--keyboard-inset`.
 * Navbar (`.mode-tabs`) esconde-se via CSS; o layout Android usa `adjustNothing`
 * para o teclado não empurrar a barra para cima.
 */
const DATA = "keyboard";
const OPEN = "open";
const MIN_INSET_PX = 120;

function isTextField(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type || "text";
    return ![
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit",
    ].includes(type);
  }
  return el.isContentEditable;
}

function keyboardInsetPx(): number {
  if (typeof window === "undefined") return 0;
  const vv = window.visualViewport;
  if (!vv) return 0;
  const inset = Math.round(window.innerHeight - vv.height - vv.offsetTop);
  return inset > MIN_INSET_PX ? inset : 0;
}

function applyKeyboardState(forceOpen?: boolean): void {
  if (typeof document === "undefined") return;
  const inset = keyboardInsetPx();
  const open = forceOpen === true || inset > 0;
  const root = document.documentElement;
  if (open) {
    root.dataset[DATA] = OPEN;
    root.style.setProperty("--keyboard-inset", `${Math.max(inset, 0)}px`);
  } else {
    delete root.dataset[DATA];
    root.style.removeProperty("--keyboard-inset");
  }
}

function scrollFieldIntoView(el: HTMLElement): void {
  try {
    el.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  } catch {
    try {
      el.scrollIntoView(true);
    } catch {
      /* ignore */
    }
  }
}

export function bootKeyboardInsets(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let focusOpen = false;
  let blurTimer: number | undefined;

  const sync = () => applyKeyboardState(focusOpen || undefined);

  const onFocusIn = (event: FocusEvent) => {
    if (!isTextField(event.target)) return;
    window.clearTimeout(blurTimer);
    focusOpen = true;
    applyKeyboardState(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (event.target instanceof HTMLElement) {
          scrollFieldIntoView(event.target);
        }
        sync();
      });
    });
  };

  const onFocusOut = () => {
    window.clearTimeout(blurTimer);
    blurTimer = window.setTimeout(() => {
      const active = document.activeElement;
      focusOpen = isTextField(active);
      sync();
    }, 180);
  };

  window.addEventListener("focusin", onFocusIn);
  window.addEventListener("focusout", onFocusOut);
  window.visualViewport?.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("scroll", sync);
  window.addEventListener("resize", sync);
  sync();
}
