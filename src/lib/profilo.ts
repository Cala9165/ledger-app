/**
 * Quali dati usa l'app su questo telefono.
 *
 * «telefono» = il salvataggio che c'era già (chiave storica `quadra-v1`).
 * «vuota» = un salvataggio a parte, che parte da zero: i dati di prima restano
 * dove sono e non si mescolano con quelli nuovi.
 */
export type Profilo = "telefono" | "vuota";

export const CHIAVE_TELEFONO = "quadra-v1";
export const CHIAVE_VUOTA = "ledger-vuota-v1";
export const CHIAVE_AVVIO = "ledger.avvio";

function ls(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Scelta fatta nella prima schermata; `null` se non è ancora stata fatta. */
export function profiloScelto(): Profilo | null {
  try {
    const v = ls()?.getItem(CHIAVE_AVVIO);
    return v === "telefono" || v === "vuota" ? v : null;
  } catch {
    return null;
  }
}

export function chiaveDi(p: Profilo): string {
  return p === "vuota" ? CHIAVE_VUOTA : CHIAVE_TELEFONO;
}

/**
 * Profilo e chiave di QUESTA scheda, fissati all'apertura. Se un'altra scheda cambia
 * profilo, questa non deve mettersi a leggere o scrivere l'altro salvataggio: si ricarica.
 */
export const PROFILO_ATTIVO: Profilo = profiloScelto() ?? "telefono";
export const CHIAVE_ATTIVA: string = chiaveDi(PROFILO_ATTIVO);

/** Chiave del salvataggio in uso da questa scheda. */
export function nomeSalvataggio(): string {
  return CHIAVE_ATTIVA;
}

/** C'è un salvataggio vero sotto quella chiave? */
export function ciSonoDati(chiave = CHIAVE_TELEFONO): boolean {
  try {
    const raw = ls()?.getItem(chiave);
    return typeof raw === "string" && raw.length > 2;
  } catch {
    return false;
  }
}

/** Riassunto del salvataggio storico, per la prima schermata. */
export function riassuntoDati(chiave = CHIAVE_TELEFONO): {
  fisse: number;
  case: number;
  cedolini: number;
  movimenti: number;
} | null {
  try {
    const raw = ls()?.getItem(chiave);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const s = parsed?.state ?? {};
    const len = (k: string) => (Array.isArray(s[k]) ? (s[k] as unknown[]).length : 0);
    return {
      fisse: len("fisse"),
      case: len("immobili"),
      cedolini: len("cedolini"),
      movimenti: len("csvMovimenti") + len("movimentiManuali"),
    };
  } catch {
    return null;
  }
}

/**
 * Salva la scelta. «Inizia vuota» usa un salvataggio a parte solo se sotto
 * quello storico c'è già qualcosa: su un telefono nuovo i dati nuovi diventano
 * semplicemente «i dati di questo telefono».
 */
export function scegliProfilo(scelta: Profilo): Profilo {
  const effettivo: Profilo = scelta === "vuota" && !ciSonoDati(CHIAVE_TELEFONO) ? "telefono" : scelta;
  try {
    ls()?.setItem(CHIAVE_AVVIO, effettivo);
  } catch {
    /* senza storage l'app resta in memoria */
  }
  return effettivo;
}
