# Ledger

Quanto ti resta al mese, quanto hai, quanto rende. Un'app di finanza personale che gira sul
telefono: dati solo in `localStorage`, niente server, niente account.

**Resta al mese = Cedolini − Spese fisse − Dal conto.** «Dal conto» è la media al giorno delle
spese di questo mese caricate dall'estratto conto, portata a un mese intero (× 30,44). Senza
spese caricate questo mese il numero non si calcola: niente mesi vuoti.

## Avvio

```bash
npm install
npm run dev          # http://localhost:5173, solo su questo computer
npm run dev:telefono # aperto alla rete di casa, per usarla dal telefono (senza dati privati)
npm run typecheck
npm run stress       # ~1.000 controlli, devono passare prima di ogni commit
npm run build
```

Al primo avvio l'app chiede: **«Continua con i dati su questo telefono»** oppure **«Inizia
vuota»**. L'app vuota usa un salvataggio a parte (`ledger-vuota-v1`): i dati che c'erano
(`quadra-v1`) restano intatti. Si cambia da Account.

## Pagine

| Pagina | Cosa fa |
|---|---|
| Home | In conto · Resta al mese · Quanto puoi chiedere in banca |
| Cedolini | Media dei cedolini caricati (stipendio e 13ª/14ª già nel netto) |
| Spese fisse | Per categoria, chiuse; modifica ed elimina dal foglio della spesa |
| Dal conto | Estratto conto CSV, movimenti per mese o per categoria |
| Casa | Immobile in 4 passi (casa, acquisto, spese, mutuo); valore, costi, rendimento, leva |
| Investi | Ci abito / La affitto / A turisti / Non è una casa: costi, debito, tre scenari |
| Quanto hai | Conto, case, fondi, investimenti, debiti |
| Glossario | Ogni parola: una riga e un esempio in euro |

## Come è fatto

- `src/lib/nomi.ts`: un concetto, un nome. Home, «i», glossario e moduli leggono da qui.
- `src/lib/conti.ts`: i numeri della Home in un posto solo.
- `src/lib/store.ts`: Zustand + persist (versione 21), hydrate difensivo, migrazioni.
- `src/lib/casa.ts`, `src/lib/investi.ts`: conti della casa e di Investi.
- Il piano di ammortamento sta dentro la spesa fissa (`Fissa.piano`), le spese di una casa
  sono spese fisse con `immobileId`, le spese di acquisto sono una lista (`speseAcquisto`).

## Dati personali

Il repository non contiene dati personali. Se serve portare in un salvataggio vecchio dati
che stavano nel codice, si mettono in `src/private/profilo.json` (ignorato da git). L'app
li aggiunge una volta sola, dove mancano, senza sovrascrivere niente:

- `npm run dev` (solo su questo computer) li porta;
- `npm run dev:telefono` e un `vite --host` qualunque **non** li portano;
- `npm run dev:telefono:dati` li porta sul telefono: si usa una volta sola, perché finché
  gira chi è sulla stessa rete può chiederli.

Nessun file di `src/private/` si scarica dal browser, in nessun modo di avvio. Una build di
produzione non li include (a meno di `VITE_PROFILO_PRIVATO=1`). La porta è fissa (5173):
su un'altra porta l'indirizzo cambia e i dati salvati sembrerebbero spariti.

Prima di pubblicare una copia del codice: `npm run dividi -- --prova` controlla che non ci
siano parole personali (elenco in `src/private/termini.txt`); `node scripts/dividi.mjs
<cartella>` crea una copia con un solo commit, senza la storia.

## Stack

React 19 · Vite 8 · TanStack Router · Zustand · Tailwind v4

## Licenza

MIT, vedi [LICENSE](LICENSE). Il software è fornito così com'è, senza garanzia: le stime non sono consulenza finanziaria.
