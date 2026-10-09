import type { Movimento } from "./banca";
import type { Regola } from "./categorie";
import type { RataPiano } from "./piano";
import type { VoceCasa } from "./quadra";

/**
 * Dati che prima stavano scritti nel codice e che servono solo al proprietario
 * per non perdere niente nel passaggio all'app nuda. Vivono in
 * `src/private/profilo.json`, cartella ignorata da git: il repository non li
 * contiene. Chi clona l'app non ha il file, e qui arriva `null`.
 */
export type ProfiloPrivato = {
  /** Piano di ammortamento per id della spesa fissa. */
  piani?: Record<string, RataPiano[]>;
  /** Movimenti che l'app mostrava prima di qualunque estratto caricato. */
  movimenti?: Movimento[];
  /** Per id di casa: prezzo al m² della zona e TAN del mutuo. */
  immobili?: Record<string, { eurMqZona?: number; mutuoTan?: number }>;
  /** Per id di casa: quali spese fisse sono sue, e che voce sono. */
  fisseCasa?: Record<string, Record<string, VoceCasa>>;
  /** Regole di classificazione dei negozi sotto casa. */
  regole?: Regola[];
};

function carica(): ProfiloPrivato | null {
  try {
    // Solo col server di sviluppo sul computer del proprietario (o chiedendolo apposta con
    // VITE_PROFILO_PRIVATO=1): una build da pubblicare non deve mai contenere questi dati.
    // In sviluppo solo se il server non è aperto alla rete (o è «dev:telefono:dati», scelto
    // apposta). Il glob importa il file comunque: quando i dati non vanno portati, vite.config.ts
    // lo fa valere null, e nessun file di src/private si scarica dal browser.
    const vuoi = (import.meta.env.DEV && __PROFILO_PRIVATO__) || import.meta.env.VITE_PROFILO_PRIVATO === "1";
    if (!vuoi) return null;
    // Vite risolve il glob a build time: senza file la mappa è vuota.
    // Fuori da Vite (script di test) import.meta.glob non esiste e si finisce nel catch.
    const mods = import.meta.glob<ProfiloPrivato>("../private/profilo.json", {
      eager: true,
      import: "default",
    });
    const first = Object.values(mods)[0];
    return first && typeof first === "object" ? first : null;
  } catch {
    return null;
  }
}

export const PROFILO_PRIVATO: ProfiloPrivato | null = carica();
