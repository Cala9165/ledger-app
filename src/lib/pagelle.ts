import type { Pagella } from "@/components/giudizio";
import { VOCI } from "./nomi";

/**
 * Voto e consigli delle percentuali della casa. Le azioni sono cose che si
 * possono fare davvero; «cosa non fare» è soprattutto non truccare le ipotesi.
 */

export function pagellaRendimento(valore: number, attivo: boolean): Pagella {
  return {
    titolo: VOCI.rendimento.nome,
    valore,
    buono: 0.07,
    medio: 0.05,
    attivo,
    soglia: "In Italia il 7 % sul costo è un buon affare, il 5 % è la norma.",
    perMigliorare: [
      "Porta il canone al livello della zona, al prossimo rinnovo del contratto.",
      "Taglia le spese che restano a te: assicurazione, amministratore, utenze non ripartite.",
      "Accorcia i mesi vuoti fra un inquilino e l'altro.",
    ],
    cosaNonFare: [
      "Non alzare a mano la rivalutazione per far tornare i conti.",
      "Non contare l'affitto dei mesi in cui la casa è vuota.",
      "Non dimenticare IMU e manutenzione: non si vedono, ma escono.",
    ],
  };
}

export function pagellaRendimentoNetto(valore: number, attivo: boolean): Pagella {
  return {
    titolo: VOCI.rendimentoNetto.nome,
    valore,
    buono: 0.045,
    medio: 0.03,
    attivo,
    soglia: "Tolte le spese, il 4–5 % è solido; sotto il 3 % la casa si mangia l'affitto.",
    perMigliorare: [
      "Rinegozia o cambia le polizze e i contratti delle spese di gestione.",
      "Fai pagare all'inquilino le utenze e le spese che la legge gli permette.",
      "Tieni la casa in ordine: un inquilino che resta costa meno di uno nuovo.",
    ],
    cosaNonFare: [
      "Non alzare a mano la rivalutazione: qui non c'entra, e non cambia l'affitto.",
      "Non togliere la manutenzione per far salire il numero.",
      "Non confrontarlo col rendimento lordo: sono due cose diverse.",
    ],
  };
}

export function pagellaLeva(valore: number, attivo: boolean): Pagella {
  return {
    titolo: VOCI.leva.nome,
    valore,
    buono: 0.015,
    medio: 0,
    attivo,
    soglia: "Sopra l'1,5 % il debito lavora per te; sotto zero ti costa mentre lo tieni.",
    perMigliorare: [
      "Se il tasso è alto, chiedi alla banca una rinegoziazione o una surroga.",
      "Se il mutuo costa più di quanto sale la casa, valuta un rimborso anticipato parziale.",
      "Confronta la tua rivalutazione con il dato di mercato, non con la speranza.",
    ],
    cosaNonFare: [
      "Non alzare a mano la rivalutazione per far diventare positiva la leva.",
      "Non allungare il mutuo quando la leva è negativa: peggiora.",
      "Non prendere altro debito sulla casa per investirlo altrove.",
    ],
  };
}

export function pagellaCredito(valore: number, attivo: boolean): Pagella {
  return {
    titolo: VOCI.creditoImposta.nome,
    valore,
    buono: 0.15,
    medio: 0.05,
    attivo,
    soglia: "Quota del costo della casa che ti torna col 730: sopra il 15 % stai usando bene le detrazioni.",
    perMigliorare: [
      "Metti nel 730 tutti gli interessi del mutuo: serve la certificazione della banca.",
      "Per i lavori scegli quelli con bonus (infissi, caldaia, tetto) e paga con bonifico parlante.",
      "Controlla ogni anno che nel 730 ci siano tutte le quote dei bonus già avviati.",
    ],
    cosaNonFare: [
      "Non contare il rimborso 730 come stipendio: arriva una volta l'anno.",
      "Non fare lavori solo per il bonus: ne recuperi al massimo una parte.",
      "Non pagare i lavori in contanti: perdi la detrazione.",
    ],
  };
}

export function pagellaInvestimento(valore: number, attivo: boolean, tipo: "casa" | "capitale" = "casa"): Pagella {
  if (tipo === "capitale") {
    return {
      titolo: "Guadagno all'anno",
      valore,
      buono: 0.07,
      medio: 0.05,
      attivo,
      soglia: "Il 7 % l'anno è il metro: sotto, un fondo indicizzato economico rende uguale.",
      perMigliorare: [
        "Abbassa i costi che si ripetono ogni anno: commissioni del fondo e del conto titoli.",
        "Se c'è un debito caro, rimborsalo prima di investire altro.",
        "Lascialo lavorare più anni: il tempo conta più del momento in cui entri.",
      ],
      cosaNonFare: [
        "Non alzare a mano «Quanto pensi che renda» per far salire il numero.",
        "Non guardare solo l'ultimo anno di mercato per decidere i prossimi dieci.",
        "Non ignorare «Il valore scende»: è quello che decide se dormi la notte.",
      ],
    };
  }
  return {
    titolo: "Guadagno all'anno",
    valore,
    buono: 0.07,
    medio: 0.05,
    attivo,
    soglia: "Il 7 % l'anno è il metro: sotto, un fondo indicizzato rende uguale senza grane.",
    perMigliorare: [
      "Abbassa i costi che si ripetono ogni anno, non quelli una tantum.",
      "Se c'è un debito caro, rimborsalo prima di investire altro.",
      "Guarda «Il valore sta fermo»: se regge lì, regge davvero.",
    ],
    cosaNonFare: [
      "Non alzare a mano «Se sale, % all'anno» per far salire il numero.",
      "Non mettere le notti occupate dei mesi migliori come media dell'anno.",
      "Non ignorare «Il valore scende»: è quello che decide se dormi la notte.",
    ],
  };
}
