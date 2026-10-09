import { Smartphone, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { ciSonoDati, riassuntoDati, scegliProfilo, type Profilo } from "@/lib/profilo";
import { plurale } from "@/lib/utils";

/**
 * Prima schermata: con quali dati parti. I dati che ci sono già restano dove
 * sono qualunque cosa tu scelga.
 */
export function Avvio({ onScelto }: { onScelto: (p: Profilo) => void }) {
  const ci = useMemo(() => ciSonoDati(), []);
  const r = useMemo(() => riassuntoDati(), []);
  const parti: string[] = [];
  if (r) {
    if (r.fisse) parti.push(plurale(r.fisse, "spesa fissa", "spese fisse"));
    if (r.case) parti.push(r.case === 1 ? "1 casa" : `${r.case} case`);
    if (r.cedolini) parti.push(plurale(r.cedolini, "cedolino", "cedolini"));
    if (r.movimenti) parti.push(plurale(r.movimenti, "movimento", "movimenti"));
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="text-sm font-semibold tracking-tight text-pine">Ledger</p>
      <h1 className="mt-6 text-3xl font-semibold leading-tight">
        Quanto ti resta, quanto hai, quanto rende.
      </h1>
      <p className="mt-3 text-[15px] text-muted">
        I dati restano su questo telefono. Niente registrazione, niente server.
      </p>

      <div className="mt-auto flex flex-col gap-3 pt-10">
        <button
          type="button"
          disabled={!ci}
          onClick={() => onScelto(scegliProfilo("telefono"))}
          className="flex min-h-20 items-center gap-4 rounded-3xl bg-ink p-5 text-left text-white disabled:opacity-40"
        >
          <Smartphone className="size-6 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold">
              Continua con i dati su questo telefono
            </span>
            <span className="mt-0.5 block text-sm text-white/70">
              {ci ? (parti.length ? parti.join(" · ") : "Salvataggio trovato") : "Non c'è niente salvato qui"}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            const p = scegliProfilo("vuota");
            // Un salvataggio a parte si carica solo ripartendo.
            if (p === "vuota") window.location.reload();
            else onScelto(p);
          }}
          className="flex min-h-20 items-center gap-4 rounded-3xl bg-surface p-5 text-left shadow-[var(--shadow-card)]"
        >
          <Sparkles className="size-6 shrink-0 text-pine" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold">Inizia vuota</span>
            <span className="mt-0.5 block text-sm text-muted">
              {ci
                ? "Zero case, zero spese. I dati di prima restano al sicuro, separati."
                : "Zero case, zero spese, zero movimenti. Metti i tuoi."}
            </span>
          </span>
        </button>
        <p className="px-1 text-center text-xs text-muted">
          Puoi cambiare quando vuoi da Account.
        </p>
      </div>
    </div>
  );
}
