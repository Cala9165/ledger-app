import { useCallback, useEffect, useRef, useState } from "react";
import { Info } from "@/components/info";
import {
  caricaMercato,
  leggiChiaveAv,
  mascheraChiave,
  nomeFonte,
  type Misura,
  type Rilevazione,
} from "@/lib/mercato";
import { pct, periodoLeggibile } from "@/lib/utils";

/** Distanza oltre la quale vale la pena proporre il dato: mezzo punto. */
const SOGLIA_DIVERSO = 0.005;

const SPIEGA: Record<Misura, string> = {
  case: "Indice ufficiale dei prezzi delle case in Italia: ultimo trimestre contro lo stesso trimestre dell’anno prima. La tua via può andare diversamente: è un paragone, non una previsione.",
  azioni:
    "Quanto è salito o sceso l’S&P 500 negli ultimi dodici mesi. Un anno solo dice poco: serve a capire dove sei nel ciclo, non quanto renderanno i prossimi dieci.",
};

/**
 * Mostra quanto sta salendo davvero il mercato, accanto al campo in cui
 * l'utente scrive l'ipotesi sua.
 *
 * Non scrive mai da solo nel campo: propone, e basta. E non chiede chiavi:
 * se la fonte ne vuole una e non c'è, la percentuale la mette l'utente.
 */
export function DatoMercato({
  misura,
  valoreAttuale,
  onUsa,
}: {
  misura: Misura;
  valoreAttuale: number;
  onUsa: (v: number) => void;
}) {
  const [dato, setDato] = useState<Rilevazione | null>(null);
  const [caricando, setCaricando] = useState(true);
  const vivo = useRef(true);

  const carica = useCallback(
    (segnale?: AbortSignal) => {
      setCaricando(true);
      return caricaMercato(misura, { segnale })
        .then((e) => {
          if (!vivo.current) return;
          setDato(e.ok ? e.dato : null);
        })
        .finally(() => {
          if (vivo.current) setCaricando(false);
        });
    },
    [misura],
  );

  useEffect(() => {
    vivo.current = true;
    const ac = new AbortController();
    carica(ac.signal);
    return () => {
      vivo.current = false;
      ac.abort();
    };
  }, [carica]);

  if (caricando) {
    return <p className="text-xs text-muted">Controllo il mercato…</p>;
  }

  if (!dato) {
    return (
      <p className="text-xs text-muted">
        Dato di mercato non disponibile adesso: metti tu la percentuale, l’app non la inventa.
      </p>
    );
  }

  const diverso = Math.abs(dato.variazioneAnnua - valoreAttuale) >= SOGLIA_DIVERSO;
  const segno = dato.variazioneAnnua >= 0 ? "+" : "";
  const chiaveSalvata = misura === "azioni" ? leggiChiaveAv() : "";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span>
        {dato.ambito}, ultimo dato:{" "}
        <b className="tabular-nums text-ink">
          {segno}
          {pct(dato.variazioneAnnua)}
        </b>{" "}
        in un anno
      </span>
      <span className="text-[11px]">
        ({nomeFonte(dato.fonte)} · {periodoLeggibile(dato.periodo)}
        {chiaveSalvata ? ` · chiave ${mascheraChiave(chiaveSalvata)}` : ""})
      </span>
      <Info titolo="Dato di mercato" testo={SPIEGA[misura]} />
      {diverso && (
        <button
          type="button"
          onClick={() => onUsa(dato.variazioneAnnua)}
          className="min-h-11 rounded-full bg-pine-2 px-3 text-xs font-medium text-pine"
        >
          Usa questo
        </button>
      )}
    </div>
  );
}
