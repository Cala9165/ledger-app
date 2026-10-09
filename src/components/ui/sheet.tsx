import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Fogli aperti, dal più vecchio al più nuovo. Solo quello in cima risponde a Esc
 * e si può toccare; sotto, la pagina e gli altri fogli sono inerti (niente Tab che
 * apre un'altra riga mentre un modulo è ancora aperto).
 */
const pila: string[] = [];
const contenitori = new Map<string, HTMLDivElement>();
const ascoltatori = new Set<() => void>();
let bloccato = false;
let overflowPrima = "";

function avvisa() {
  if (typeof document === "undefined") return;
  const root = document.getElementById("root");
  if (root) {
    if (pila.length) root.setAttribute("inert", "");
    else root.removeAttribute("inert");
  }
  // Inerte subito (non al prossimo render): così il focus può tornare sul foglio di sotto.
  const cima = pila[pila.length - 1];
  for (const [id, el] of contenitori) {
    if (id === cima) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }
  // Lo scorrimento si blocca sulla pagina intera (html), una volta sola per tutti i fogli.
  const html = document.documentElement;
  if (pila.length && !bloccato) {
    overflowPrima = html.style.overflow;
    html.style.overflow = "hidden";
    bloccato = true;
  } else if (!pila.length && bloccato) {
    html.style.overflow = overflowPrima;
    bloccato = false;
  }
  for (const f of ascoltatori) f();
}
function iscrivi(f: () => void) {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}

/**
 * Foglio che sale dal basso, come nelle app delle banche.
 * Una cosa alla volta: sotto resta la pagina, oscurata.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  primaDiChiudere,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Tocco sul fondo o Esc: se torna false il foglio resta aperto (es. flusso a metà). La X chiude sempre. */
  primaDiChiudere?: () => boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  // Il genitore passa spesso una funzione nuova a ogni render: l'effetto non deve
  // ripartire (rimetterebbe il focus sul foglio mentre scrivi in un campo).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const primaRef = useRef(primaDiChiudere);
  primaRef.current = primaDiChiudere;
  const chiudiMorbido = () => {
    if (primaRef.current && !primaRef.current()) return;
    closeRef.current();
  };
  const inCima = useSyncExternalStore(
    iscrivi,
    () => pila[pila.length - 1] === titleId,
    () => true,
  );

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    if (boxRef.current) contenitori.set(titleId, boxRef.current);
    pila.push(titleId);
    avvisa();
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      // Esc chiude solo il foglio in cima, non tutti quelli aperti.
      if (e.key === "Escape" && pila[pila.length - 1] === titleId) {
        e.stopPropagation();
        if (primaRef.current && !primaRef.current()) return;
        closeRef.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      const i = pila.lastIndexOf(titleId);
      if (i >= 0) pila.splice(i, 1);
      contenitori.delete(titleId);
      avvisa();
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus?.();
    };
  }, [open, titleId]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={boxRef}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      inert={!inCima || undefined}
    >
      <button
        type="button"
        aria-label="Chiudi"
        tabIndex={-1}
        className="anim-fade absolute inset-0 cursor-default bg-ink/40"
        onClick={chiudiMorbido}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "anim-sheet relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-[var(--shadow-sheet)] outline-none sm:rounded-3xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <h2 id={titleId} className="min-w-0 text-lg font-semibold leading-snug">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer ? (
          <div className="border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : (
          <div className="pb-[env(safe-area-inset-bottom)]" />
        )}
      </div>
    </div>,
    document.body,
  );
}
