import type { ReactNode } from "react";
import { cn, money } from "@/lib/utils";

/**
 * «Conviene tenerti la casa o andare in affitto?» — lo stesso confronto in Casa
 * e in Investi, con le stesse parole: due colonne, tre numeri ciascuna.
 */
export function ConfrontoCasa({
  esceProprietario,
  esceAffitto,
  parteTua,
  imuAnno,
  recupero730Anno,
  costoVeroMese,
  affittoMese,
  hidden,
  dettaglio,
}: {
  /** Rata del mutuo + spese della casa: quello che esce dal conto ogni mese. */
  esceProprietario: number;
  /** Affitto + bollette che pagheresti comunque; 0 se non l'hai scritto. */
  esceAffitto: number;
  parteTua: number;
  imuAnno: number;
  recupero730Anno: number;
  /** Interessi + spese + manutenzione − 730: il costo vero, senza la quota capitale. */
  costoVeroMese: number;
  affittoMese: number;
  hidden: boolean;
  dettaglio?: ReactNode;
}) {
  const tasseNette = imuAnno - recupero730Anno;
  const tasseSotto =
    imuAnno > 0 && recupero730Anno > 0
      ? `IMU ${money(imuAnno, hidden, 0)} meno ${money(recupero730Anno, hidden, 0)} dal 730, all'anno`
      : imuAnno > 0
        ? "IMU all'anno"
        : recupero730Anno > 0
          ? "ti torna col 730, all'anno"
          : "niente IMU né 730";
  const differenza = affittoMese - costoVeroMese;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Colonna
          titolo="Resto proprietario"
          righe={[
            ["Esce al mese", money(esceProprietario, hidden, 0), "rata e spese della casa"],
            ["La parte tua", money(parteTua, hidden, 0), "resta nella casa"],
            [
              "Tasse",
              imuAnno > 0 || recupero730Anno > 0
                ? `${tasseNette < 0 ? "−" : ""}${money(Math.abs(tasseNette), hidden, 0)}`
                : "—",
              tasseSotto,
            ],
          ]}
        />
        <Colonna
          titolo="Vado in affitto"
          righe={[
            ["Esce al mese", esceAffitto > 0 ? money(esceAffitto, hidden, 0) : "—", "affitto e bollette"],
            ["La parte tua", money(parteTua, hidden, 0), "libera, se vendi"],
            ["Tasse", "—", "niente IMU, niente 730 sugli interessi"],
          ]}
        />
      </div>
      {affittoMese > 0 ? (
        <p className={cn("rounded-2xl p-3 text-sm", differenza >= 0 ? "bg-pine-2" : "bg-amber-2")}>
          Contando solo i costi veri (interessi, spese, manutenzione, meno il 730), restando spendi{" "}
          <b>
            {money(Math.abs(differenza), hidden, 0)} {differenza >= 0 ? "in meno" : "in più"}
          </b>{" "}
          al mese. La quota capitale della rata non è persa: abbassa il debito.
        </p>
      ) : (
        <p className="text-sm text-muted">Scrivi quanto costerebbe l'affitto di una casa simile per fare il confronto.</p>
      )}
      {dettaglio}
    </div>
  );
}

function Colonna({ titolo, righe }: { titolo: string; righe: [string, string, string][] }) {
  return (
    <div className="rounded-2xl bg-paper p-3">
      <p className="text-sm font-semibold">{titolo}</p>
      <dl className="mt-2 flex flex-col gap-2.5">
        {righe.map(([k, v, s]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="text-[17px] font-semibold tabular-nums">{v}</dd>
            <dd className="text-[11px] leading-tight text-muted">{s}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
