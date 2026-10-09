import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn, pct } from "@/lib/utils";

export type Fascia = "buono" | "medio" | "male";

/**
 * Fascia di un valore rispetto a due soglie.
 * `buono` e `medio` sono i punti di taglio: >= buono, >= medio, altrimenti male.
 */
export function fascia(valore: number, buono: number, medio: number): Fascia {
  if (valore >= buono) return "buono";
  if (valore >= medio) return "medio";
  return "male";
}

export const STILE_FASCIA: Record<Fascia, { parola: string; punto: string; testo: string; fondo: string }> = {
  buono: { parola: "Buono", punto: "bg-pine", testo: "text-pine", fondo: "bg-pine-2" },
  medio: { parola: "Nella media", punto: "bg-amber", testo: "text-amber", fondo: "bg-amber-2" },
  male: { parola: "Sotto", punto: "bg-brick", testo: "text-brick", fondo: "bg-brick-2" },
};

export type Pagella = {
  titolo: string;
  valore: number;
  buono: number;
  medio: number;
  /** Il metro di paragone, in una frase. */
  soglia: string;
  /** Al massimo tre azioni vere. */
  perMigliorare: string[];
  /** Al massimo tre. */
  cosaNonFare: string[];
  /** Con dati mancanti non si dà un voto: meglio il silenzio. */
  attivo?: boolean;
  /** Righe coi tuoi numeri, se servono. */
  dettaglio?: ReactNode;
};

/**
 * Una percentuale che si tocca: sale un foglio con il voto (Buono / Nella media /
 * Sotto), cosa fare per migliorarla e cosa non fare.
 */
export function PercentualeVoto({
  pagella,
  className,
  cifre = 1,
}: {
  pagella: Pagella;
  className?: string;
  cifre?: number;
}) {
  const [open, setOpen] = useState(false);
  const { valore, buono, medio, attivo = true } = pagella;
  if (!attivo || !Number.isFinite(valore)) {
    return <span className={cn("tabular-nums text-muted", className)}>—</span>;
  }
  const f = fascia(valore, buono, medio);
  const s = STILE_FASCIA[f];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${pagella.titolo}: ${pct(valore, cifre)}, ${s.parola}. Tocca per i consigli`}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold tabular-nums",
          s.fondo,
          s.testo,
          className,
        )}
      >
        <span className={cn("size-2 rounded-full", s.punto)} aria-hidden="true" />
        {pct(valore, cifre)}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={pagella.titolo}
        footer={
          <Button className="w-full" onClick={() => setOpen(false)}>
            Ho capito
          </Button>
        }
      >
        <div className={cn("flex items-center justify-between rounded-2xl p-4", s.fondo)}>
          <div>
            <p className={cn("text-sm font-semibold", s.testo)}>{s.parola}</p>
            <p className="mt-0.5 text-xs text-muted">{pagella.soglia}</p>
          </div>
          <p className={cn("text-2xl font-semibold tabular-nums", s.testo)}>{pct(valore, cifre)}</p>
        </div>
        {pagella.dettaglio ? <div className="mt-4 text-sm">{pagella.dettaglio}</div> : null}
        <Elenco titolo="Per migliorare" righe={pagella.perMigliorare.slice(0, 3)} segno="+" />
        <Elenco titolo="Cosa non fare" righe={pagella.cosaNonFare.slice(0, 3)} segno="×" />
      </Sheet>
    </>
  );
}

function Elenco({ titolo, righe, segno }: { titolo: string; righe: string[]; segno: string }) {
  if (!righe.length) return null;
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{titolo}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {righe.map((r) => (
          <li key={r} className="flex gap-2.5 text-[15px] leading-snug">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                segno === "+" ? "bg-pine-2 text-pine" : "bg-brick-2 text-brick",
              )}
              aria-hidden="true"
            >
              {segno}
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
