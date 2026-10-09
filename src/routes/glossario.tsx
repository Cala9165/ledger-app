import { createFileRoute } from "@tanstack/react-router";
import { VOCI, type IdVoce } from "@/lib/nomi";

export const Route = createFileRoute("/glossario")({ component: GlossarioPage });

/** L'ordine in cui le parole si incontrano usando l'app. */
const ORDINE: IdVoce[] = [
  "restaAlMese",
  "inConto",
  "cedolini",
  "speseFisse",
  "dalConto",
  "quantoPuoiChiedere",
  "cuscinetto",
  "quantoHai",
  "valoreCasa",
  "costoCasa",
  "creditoImposta",
  "rendimento",
  "rendimentoNetto",
  "leva",
  "tan",
  "rivalutazione",
  "manutenzione",
  "sfitto",
  "inflazione",
  "copiaSicurezza",
];

function GlossarioPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="px-1">
        <h1 className="text-2xl font-semibold">Glossario</h1>
        <p className="mt-1 text-[15px] text-muted">Le parole dell'app, con un esempio in euro.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {ORDINE.map((id) => {
          const v = VOCI[id];
          return (
            <li key={id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
              <h2 className="font-semibold">{v.nome}</h2>
              <p className="mt-1 text-[15px] leading-relaxed">{v.riga}</p>
              <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm tabular-nums">
                <span className="font-medium text-muted">Esempio: </span>
                {v.esempio}
              </p>
              {"tecnico" in v && v.tecnico ? (
                <p className="mt-2 text-xs text-muted">In inglese o in banca: {v.tecnico}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
