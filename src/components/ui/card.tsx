import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  tono = "chiaro",
}: {
  children: ReactNode;
  className?: string;
  tono?: "chiaro" | "scuro";
}) {
  return (
    <section
      className={cn(
        "rounded-3xl p-5",
        tono === "scuro"
          ? "bg-ink text-white shadow-[var(--shadow-card)]"
          : "bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Il numero grande di una card. */
export function Cifra({
  children,
  className,
  size = "xl",
}: {
  children: ReactNode;
  className?: string;
  size?: "lg" | "xl" | "2xl";
}) {
  return (
    <p
      className={cn(
        "font-semibold tabular-nums tracking-tight",
        size === "2xl" ? "text-[2.5rem] leading-tight" : size === "xl" ? "text-3xl" : "text-2xl",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Riga compatta di un elenco: nome a sinistra, importo a destra, tocco per aprire. */
export function Riga({
  titolo,
  sotto,
  importo,
  onClick,
  tono,
  freccia = !!onClick,
  className,
}: {
  titolo: ReactNode;
  sotto?: ReactNode;
  importo?: ReactNode;
  onClick?: () => void;
  tono?: "positivo" | "negativo" | "spento";
  freccia?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[15px]", tono === "spento" && "text-muted line-through decoration-muted/40")}>
          {titolo}
        </span>
        {sotto ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{sotto}</span> : null}
      </span>
      {importo !== undefined ? (
        <span
          className={cn(
            "shrink-0 text-[15px] font-medium tabular-nums",
            tono === "positivo" && "text-pine",
            tono === "negativo" && "text-brick",
            tono === "spento" && "text-muted",
          )}
        >
          {importo}
        </span>
      ) : null}
      {freccia ? <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" /> : null}
    </>
  );
  const cls = cn("flex min-h-12 w-full items-center gap-3 py-2 text-left", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Scelta fra due o tre opzioni, a pillola. */
export function Segmenti<T extends string>({
  valore,
  opzioni,
  onChange,
  label,
  className,
}: {
  valore: T;
  opzioni: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-1 rounded-2xl bg-paper-2 p-1", className)}
      style={{ gridTemplateColumns: `repeat(${opzioni.length}, minmax(0, 1fr))` }}
    >
      {opzioni.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valore === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-11 rounded-xl px-2 text-sm font-medium",
            valore === o.id ? "bg-surface text-ink shadow-[var(--shadow-border)]" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Titolo di pagina con il numero principale sotto. */
export function Intestazione({
  titolo,
  destra,
  children,
}: {
  titolo: ReactNode;
  destra?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{titolo}</h1>
        {destra}
      </div>
      {children}
    </div>
  );
}

export function Vuoto({ children, azione }: { children: ReactNode; azione?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface/60 p-5 text-center">
      <p className="text-sm text-muted">{children}</p>
      {azione ? <div className="mt-3 flex justify-center">{azione}</div> : null}
    </div>
  );
}
