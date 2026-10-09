import { ChevronDown } from "lucide-react";
import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type Ctx = { aperto: string | null; apri: (id: string | null) => void };
const AccordionCtx = createContext<Ctx | null>(null);

/** Un gruppo di voci richiudibili: se ne apre una, le altre si chiudono. */
export function AccordionGroup({
  children,
  iniziale = null,
  className,
}: {
  children: ReactNode;
  iniziale?: string | null;
  className?: string;
}) {
  const [aperto, apri] = useState<string | null>(iniziale);
  return (
    <AccordionCtx.Provider value={{ aperto, apri }}>
      <div className={cn("flex flex-col gap-2", className)}>{children}</div>
    </AccordionCtx.Provider>
  );
}

/** Stato del gruppo, per chi deve aprire una voce da fuori (es. dopo «Aggiungi»). */
export function useAccordion(): Ctx {
  const c = useContext(AccordionCtx);
  if (!c) throw new Error("useAccordion fuori da AccordionGroup");
  return c;
}

export function AccordionItem({
  id,
  titolo,
  sotto,
  destra,
  children,
  tono = "normale",
  className,
}: {
  id: string;
  titolo: ReactNode;
  sotto?: ReactNode;
  destra?: ReactNode;
  children: ReactNode;
  tono?: "normale" | "attenzione";
  className?: string;
}) {
  const ctx = useContext(AccordionCtx);
  const [locale, setLocale] = useState(false);
  const aperto = ctx ? ctx.aperto === id : locale;
  const btnRef = useRef<HTMLButtonElement>(null);
  const topPrima = useRef<number | null>(null);
  const toggle = () => {
    // Se sopra si chiude una voce lunga, questa salirebbe fuori dallo schermo:
    // ci si ricorda dov'era per rimetterla lì.
    topPrima.current = btnRef.current?.getBoundingClientRect().top ?? null;
    if (ctx) ctx.apri(aperto ? null : id);
    else setLocale((v) => !v);
  };
  useLayoutEffect(() => {
    const t0 = topPrima.current;
    topPrima.current = null;
    const btn = btnRef.current;
    if (t0 === null || !btn) return;
    const d = btn.getBoundingClientRect().top - t0;
    if (Math.abs(d) <= 1) return;
    let el: HTMLElement | null = btn.parentElement;
    while (el && !(el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) {
      el = el.parentElement;
    }
    if (el) el.scrollTop += d;
    else window.scrollBy(0, d);
  }, [aperto]);
  const panelId = useId();
  return (
    <section
      className={cn(
        "rounded-2xl bg-surface shadow-[var(--shadow-card)]",
        tono === "attenzione" && "ring-1 ring-amber/30",
        className,
      )}
    >
      <button
        type="button"
        ref={btnRef}
        aria-expanded={aperto}
        aria-controls={panelId}
        onClick={toggle}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{titolo}</span>
          {sotto ? <span className="mt-0.5 block truncate text-xs text-muted">{sotto}</span> : null}
        </span>
        {destra ? <span className="shrink-0 text-right tabular-nums">{destra}</span> : null}
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted transition-transform", aperto && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {aperto ? (
        <div id={panelId} className="border-t border-border px-4 pt-2 pb-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
