# Ledger · stato, bug aperti e futuro

Documento di consegna. Serve a riprendere il lavoro da zero in una sessione nuova,
senza aver letto la conversazione in cui è stato scritto.

Scritto il **16 settembre 2026** (commit `e487838`), aggiornato al **9 ottobre 2026**
(commit `04afee2`).

> **Aggiornamento 9 ottobre 2026 — bug chiusi e copia pubblica online.**
> - I **7 bug del §4 sono tutti chiusi** (commit `016a915`, «Giri 1 e 2»): mese del
>   cedolino (anno solo fra l'anno scorso e il prossimo, e il cedolino ora si modifica e si
>   cancella), prezzo da cache col suo orario vero, due schede aperte che si rileggono,
>   righe del salvataggio rovinate contate e tenute da parte invece di bloccare tutto,
>   rimborso 730 in tutti e due gli ordini, numeri del PDF Fon.Te interi, messaggio di
>   Banca rifatto.
> - Dal telefono si può salvare (prima ogni «Salva» si fermava: `crypto.randomUUID` non
>   c'è su http); i file di `src/private/` non arrivano più al browser in nessun modo di
>   avvio; porta fissa 5173. Dettagli nel README, «Dati personali».
> - **Copia pubblica fatta** (§11): `github.com/Cala9165/ledger-app`, un solo commit
>   (`806b290`), firmato `Ledger <209085895+Cala9165@users.noreply.github.com>`. Il
>   repository di lavoro `Cala9165/ledger` resta **privato** ed è allineato con GitHub.
> - Numeri di oggi: 63 file tracciati, ~15.000 righe TS/TSX, `npm run stress` → **1.134
>   controlli**, tutti verdi; c'è la licenza MIT.
> - Ancora aperto: le aree del §5 dalla 2 alla 6 (mai setacciate) e i limiti del §7 (niente
>   backup né sincronizzazione, tetto dei ~5 MB, niente CI).
>
> **Fase 2, area 1 (matematica di Investi) — fatta il 9 ottobre.** Quattro errori riprodotti
> con script e corretti, ognuno con i suoi controlli in `stress` (ora 1.151):
> 1. **Rata scritta senza tasso → interessi zero** (Investi *e* Casa). Chi sa la rata ma non il
>    tasso vedeva «costo vero» senza interessi e, in Affitto, un guadagno in 10 anni quasi
>    doppio (72.789 € invece di 36.689 € nell'esempio). Ora il tasso si ricava da debito, rata
>    e ultima rata (`tanDallaRata` in `affare.ts`, `tanEffettivo` in `investi.ts`, usato anche
>    da `interessiMese` in `casa.ts`); senza ultima rata non si può, e Investi lo dice.
> 2. **Rata più bassa degli interessi**: l'app contava pagati gli interessi interi (5.000 €
>    l'anno con una rata da 100 € al mese). Ora esce la rata, il resto va sul debito, e un
>    avviso chiede di controllare.
> 3. **Investimento con costi annui più grandi del capitale**: 100 € con 300 € di costi
>    l'anno davano **+102.300 €** in 10 anni (una base negativa alla decima è positiva). Ora
>    si perde tutto, come nella realtà.
> 4. Il consiglio di «Guadagno all'anno» per i fondi citava «Il valore scende», che lì si
>    chiama «Un anno brutto prima di vendere».
>
> Rimasti fuori, da decidere: la leva in Casa (`pascalLeva`) usa solo il tasso scritto, e
> con il tasso vuoto tace invece di usare quello ricavato; una rata che non basta a chiudere
> il debito entro l'ultima rata non viene segnalata.

> **Aggiornamento 25 settembre 2026 — app nuda.** Interfaccia e nomi rifatti come un'app di
> banca (Home a tre card, «i» a foglio con esempio in euro, accordion con una voce aperta,
> glossario). Prima schermata «Continua con i dati su questo telefono» / «Inizia vuota», con
> salvataggi separati. Il repository non contiene dati personali: i dati di chi usa l'app
> stanno solo nel suo salvataggio (in sviluppo si possono importare una volta da
> `src/private/`, ignorato da git). I casi speciali legati a una casa precisa sono diventati
> campi di ogni immobile (prezzo al m² della zona, TAN, spese legate alla casa).
> Il voto 0–10 di Investi è sostituito da Buono / Nella media / Sotto con tre scenari. La
> formula di «Resta al mese» (ex CF = E − F − V) non è cambiata. I §6 e §7 qui sotto
> descrivono lo stato di prima. Si pubblica una copia con un solo commit, senza la storia
> di sviluppo: vedi §11.

---

## 1. Cos'è Ledger, in trenta secondi

Un conto personale, non un'app di finanza personale. Nasce da un problema preciso:
**non mescolare i soldi che escono, i soldi che restano e il valore sulla carta.**

Identità unica, da cui discende tutto il resto:

```
CF = E − F − V
```

| Termine | Significato | Da dove viene |
|---|---|---|
| **E** | Entrate | media dei cedolini caricati, non uno stipendio inventato |
| **F** | Fisse | uscite in competenza (mutuo, condominio, TARI, utenze, palestra) |
| **V** | Variabili | solo dal CSV caricato, run-rate del mese in corso (media giorno × 30,44) |

Da lì: quanto resta sul conto, e quanto debito ci si può ancora permettere
(`min(CF, 33 % × E − debiti)` — il 33 % della banca è un tetto, non la verità).

Tre numeri che vanno tenuti **distinti**, perché le banche li mescolano:

- **Cash flow** — soldi che restano dopo uscite vere
- **Equity** — quanto è tuo se vendi (carta, non cassa)
- **Yield** — se un investimento sta sopra o sotto il 7 %, anche con prezzi in calo e inflazione

### Le sette pagine

| Pagina | Risponde a |
|---|---|
| Home | «Quanto mi resta, senza inventare uscite?» |
| Fisse | anagrafica uscite fisse, piano mutuo/prestito |
| Banca | import CSV PSD2, categorie, viste Tutte/Periodo/Attive/Archiviate |
| Casa | immobili, equity, plusvalenza |
| Investi | rendimenti: immobile, debito, investimenti |
| Fondo | patrimonio, Fon.Te, investimenti, prezzi live |
| Formule | come sono calcolati CF, DTI, rendimenti |

### Stack

React 19 · Vite 8 · TanStack Router · Zustand · Tailwind v4
**Nessun server, nessun account.** Dati solo in `localStorage`, chiave `quadra-v1`.

- 47 file tracciati, ~12.700 righe TS/TSX
- `npm run stress` → **702 asserzioni** in un unico script (`scripts/stress.mts`)
- `npm run typecheck` → `tsc --noEmit`

---

## 2. Le regole non negoziabili

Vengono dal proprietario e il codice le rispetta. **Chi lavora qui non le rompe.**

1. Non inventare voci di spesa «varie».
2. Non usare mesi senza spese effettivamente caricate.
3. Non trattare la rata del mutuo come se fosse un affitto.
4. Non far riapparire fisse o case cancellate.
5. Deve funzionare con 0, 1 o più case, e per utenti diversi dal proprietario.
6. Niente server, niente account: gira sul telefono, dati nel browser.
7. Non è un prodotto di lavoro: questo è personale.

### Regole di stile emerse lavorando

- **Terminologia**: tenere il termine tecnico corretto (serve anche a parlare con la
  banca) e spiegarlo in una riga. **Mai** sostituirlo con una parafrasi da bambini:
  è stato provato ed è stato bocciato. «Quel che resta dopo le spese» è una rinuncia,
  «Reddito operativo netto» più una riga di spiegazione è la strada giusta.
- **Niente notazione da paper**: la `g` della rivalutazione è stata eliminata ovunque.
- **Gerarchia, non più testo**: una tabella di risultati si scansiona, non si legge.
  Un numero grande, il resto compatto in un dettaglio richiudibile. Spiegazione una
  volta in cima al blocco, non sotto ogni riga.
- **L'app propone, non decide**: nessun campo viene mai scritto automaticamente da
  una fonte esterna. Si mostra il dato e un pulsante «Usa questo».
- **Con dati mancanti, silenzio**: mai un giudizio o un voto su campi vuoti. Un
  «Sotto la media» calcolato sul nulla è una bugia, non un'informazione.
- **Ogni percentuale dice se è buona**: componente `Giudizio` in
  `src/components/giudizio.tsx` — pallino colorato, parola, e la soglia spiegata.

---

## 3. Cosa è stato fatto (sessione 14–16 settembre 2026)

### Terminologia e leggibilità
- `bced9fb` **Investi rifatto**: via la `g` (compariva 4 volte a schermo), via
  NOI/ADR/cap rate/cash-on-cash/yield on cost. Risolta la collisione su «Capitale»
  (scheda → *Investimenti*, campo mutuo → *Debito residuo*). Nuova gerarchia con
  verdetto grande e barra sulla soglia 7 %. Ogni scheda chiude con la riga che dice
  dove ti stai raccontando una storia.
- `c8bdce9` **Giudizi in Casa**: ogni percentuale accompagnata da Buono / Nella media
  / Sotto la media, con la soglia italiana spiegata nella «i».

### Bug corretti
- `f375ad3` Riquadri «i» che uscivano dallo schermo (7 su 17 in Investi, fino a 82 px
  di testo tagliato) + tondino «i» portato a 44 px di area sensibile.
- `a921b98` «Nascondi importi» lasciava scoperto un importo; schermata d'errore tutta
  in inglese e coi colori sbagliati; la stessa sezione si chiamava *Fondo* nel menu e
  *Posizioni* nel titolo.
- `1ea10e5` **Salvataggio silenzioso**: in 4 moduli (Fondo, Casa, Fisse, Banca) il
  controllo sul nome usciva con `return` muto. Premevi Salva e non succedeva niente.
- `04a7e4d` **Casa fantasma**: `equity()` deduceva dal *numero* di case se usare la
  lista o il patrimonio globale. Cancellata l'ultima casa il patrimonio restava
  tutto il valore della casa cancellata invece del solo resto, e sopravviveva al riavvio.
  **Archiviazione gemelle**: due spese identiche lo stesso giorno avevano la stessa
  identità, archiviarne una archiviava l'altra e V calava del doppio.
  **Preset Carta**: allargava il periodo a mesi senza spese e schiacciava il run-rate di quasi 10 volte.
- `e487838` Metri quadri azzerati che tornavano al valore di prima al riavvio; mutuo cancellato che
  lasciava l'immobile agganciato a una fissa inesistente (interessi e 730 fantasma).

### Funzioni nuove
- `81c6f4d` **Categorie personalizzate nelle fisse**. Cancellandone una, le fisse che
  la usavano tornano ad *Altro* invece di restare orfane.
- `14eba22` **Collegamento al mercato immobiliare**: Eurostat, indice trimestrale dei
  prezzi delle abitazioni. Nessuna chiave, nessun login, CORS aperto. Italia +5,2 %
  annuo. Compare accanto alla *Rivalutazione attesa* in Investi e Casa.
- `c76e889` **S&P 500** via Alpha Vantage (chiave gratuita). Ogni fonte dichiara cosa
  misura (`case` / `azioni`), cache separate.

### Metodo che ha funzionato
Agenti in parallelo che **riproducono** il bug con script eseguiti (`npx tsx`), seguiti
da un verificatore ostile istruito a smontarli — in dubbio si scarta. Resa: **19
risultati, 14 confermati, 5 smontati**. Il verificatore ha anche corretto proposte
sbagliate (es. un filtro sugli archiviati che non serviva e avrebbe rotto il preset).

⚠️ **Il limite di sessione è il vero collo di bottiglia.** Due giri di agenti sono
morti per quello: 7 su 12 il primo, 6 su 6 il secondo. Pianificare di conseguenza.

---

## 4. Bug trovati il 16/9 — ✅ tutti chiusi il 9/10

Tutti verificati con script eseguiti e passati da un verificatore ostile.
Ordinati per gravità. **Corretti tutti e sette** in `016a915`, ognuno con i suoi controlli
in `scripts/stress.mts`; la descrizione resta qui come storia (righe e file sono quelli di
allora).

### 🔴 ALTA — Il mese del cedolino indovinato male, e poi non correggibile
`src/lib/quadra.ts:541` (`guessCedolinoMese`)

`Cedolino 3103.pdf` → `2031-03`. `cedolino_2812.pdf` → `2028-12`.
`cedolino_ditta2105_marzo2026.pdf` → `2021-05`.
Il primo ramo `/(\d{2})(\d{2})/` è ambiguo fra AAMM e GGMM e accetta come anno
qualunque coppia ≥ 20, cioè **tutti i giorni dal 20 al 31**.

**Peggio**: una volta sbagliato, il cedolino **non si può né correggere di mese né
cancellare**. E resta sbagliata per sempre, e con lei tutto il CF.

*Fix*: (1) restringere l'anno a `corrente −1 … +1`; pretendere un separatore vero fra
anno e mese nel secondo ramo. (2) **Costruire** la modifica e la cancellazione di un
cedolino: è interfaccia nuova più azioni nello store, non una correzione.

### 🔴 ALTA — Prezzo vecchio timbrato come aggiornato adesso
`src/routes/patrimonio.tsx:116`, `src/lib/prezzi.ts`

Rete assente, cache di giorni fa: il prezzo viene ripescato ma
`prezzoAggiornatoAt` viene scritto a **adesso**. Su tre giri del poll automatico il
timbro avanza (20:52, 20:59, 21:06) mentre la cache resta ferma al 09/09. L'utente
crede di guardare un prezzo fresco.

*Fix*: aggiungere `observedAt?: Record<string, number>` a `PriceFetchResult`,
popolarlo nel ramo di ripiego e in quello di sola cache, e usarlo come timbro invece
dell'ora corrente. Mostrare «da cache» nell'interfaccia.

### 🟡 MEDIA — Due schede aperte: la seconda cancella la prima
`src/lib/store.ts:663`

Riprodotto: scheda A aggiunge un movimento → il blob lo contiene. Scheda B fa una
qualsiasi scrittura → il blob **non lo contiene più**. Ricarichi e il movimento è perso.

*Fix*: `window.addEventListener("storage", …)` con `useQuadra.persist.rehydrate()`.
Cautela: l'evento non scatta nella scheda che ha scritto, e `rehydrate` passa da
`hydratePersisted`, che con `...current` conserva le azioni.

### 🟡 MEDIA — Cedolino senza campo «mese»: ripristino fallisce in silenzio
`src/lib/quadra.ts:536` (`mergeMissingCedolini`)

Una riga malformata fa fallire il rehydrate: l'app riparte dai valori iniziali invece
che dal salvataggio e **la prima modifica sovrascrive il salvataggio vero**. Perdita di
dati silenziosa.

*Fix*: normalizzare prima di ordinare — riparare le righe invece di buttarle.

### 🟡 MEDIA — Il rimborso 730 riconosciuto solo in un ordine
`src/lib/quadra.ts:515` (`extraCedolino`)

La regex pretende l'importo **prima** della parola 730. Nell'ordine inverso il
rimborso non viene scorporato e **E è gonfiata**. In più `arretrati 2026 730` e
`rimborso irpef 2025 730` fanno scambiare **un anno per un importo**.

*Fix*: rifiutare la cattura quando il numero è un anno plausibile (1900–2100) senza
€ adiacente; aggiungere un secondo tentativo ancorato a € o a «di cui».

### 🟡 MEDIA — PDF Fon.Te: numeri troncati a 3 cifre
`src/lib/fonte.ts:726` (`findNearAmount`)

`Numero quote 4051,2345` → **405**. E viene presentato con confidenza «alta», senza
avvisi. L'alternativa con i gruppi da 3 cifre viene provata per prima e si ferma lì.

*Fix*: `*` → `+` sul gruppo migliaia (quell'alternativa vale solo per numeri davvero
raggruppati) e seconda alternativa `\d+(?:[,.]\d+)?`.

### ⚪ BASSA — Messaggio fuorviante con tutte le variabili archiviate
`src/routes/banca.tsx:512`

Dice «in questo intervallo ci sono solo fisse, entrate o prelievi» anche quando le
variabili ci sono ma sono tutte archiviate.

*Fix*: contare le archiviate prima di ricadere su quel messaggio.

---

## 5. Aree mai passate al setaccio

Nessun agente è ancora riuscito a coprirle (limite di sessione). **Qui ci sono
quasi certamente altri bug.**

1. **Matematica di Investi** (`src/lib/affare.ts`) — rata con tasso 0 o durata 0;
   interessi del primo anno quando la rata non copre gli interessi; il voto che esce
   dal suo intervallo; occupazione turistica oltre 100 %.
2. **Fon.Te** (`src/lib/fonte.ts`) — percentuali ×100; TFR diviso 13,5 due volte;
   snapshot che sovrascrive dati manuali; contributi contati due volte.
3. **Pagina Formule** — la formula *mostrata* può non essere quella *applicata*.
   Va confrontata simbolo per simbolo con le funzioni vere.
4. **Terminologia** su Banca, Fondo, Home, Fisse, Formule e i messaggi d'errore.
5. **Accessibilità** — nomi accessibili, contrasto reale della palette, `role="alert"`,
   ordine di tabulazione.
6. **Coerenza fra sezioni** — lo stesso numero (F, V, equity, mutuo, patrimonio, DTI)
   calcolato da funzioni diverse in pagine diverse. Dove divergono, l'app si contraddice.

---

## 6. I due rischi che non sono bug

### ✅ Dati personali nel codice — risolto il 25/9

Prima il codice partiva con dati veri al posto di quelli di esempio. Ora non più: ognuno
usa i propri, salvati sul proprio dispositivo. Vedi la nota in cima e il §11.

### ⚖️ Il voto sugli investimenti

L'app dà **un voto da 0 a 10** e scrive **«Non conviene»** sulle scelte di
investimento. Sul computer del proprietario è un calcolatore. Distribuita al pubblico,
in Europa, sfiora la **consulenza finanziaria**, che è attività regolata (MiFID II).
Non è un dettaglio da sistemare dopo: cambia cosa si può scrivere a schermo.

---

## 7. Perché oggi non è usabile da un altro

Non è un'app all'80 %. È un **attrezzo su misura**, e lo è per scelta — per questo
funziona bene. Aprirla ad altri non è finirla, è rifondarla.

- **31 punti** in 8 file trattavano una casa e un mutuo specifici come casi speciali
  (TAN, €/m² della zona, condominio, fornitori): ora sono campi di ogni immobile.
- **10 file** con logica fiscale italiana: 730, IMU, TARI, TFR, Fon.Te, detrazione 19 %.
- Un utente nuovo partiva con **dati non suoi**, invece che da zero.
- Nessuna accoglienza: si presume che tu sappia cosa sia `CF = E − F − V`.

### Cosa manca sul piano dell'infrastruttura

| Manca | Conseguenza |
|---|---|
| Account e sincronizzazione | cambi telefono → perdi tutto |
| Backup | pulisci i dati del browser → perdi tutto |
| Spazio oltre i ~5 MB di localStorage | ~50k movimenti CSV ≈ 4–5 MB, poi **il salvataggio fallisce in silenzio** |
| CI (`.github` assente) | typecheck e stress girano solo se qualcuno se li ricorda |
| ~~Licenza~~ | ✅ MIT dal 27/9 (`LICENSE`) |
| Privacy policy | obbligatoria dal momento in cui esiste un server |
| Internazionalizzazione | tutte le stringhe scritte a mano in italiano |

---

## 8. Il futuro, in fasi

### Fase 0 — Igiene (mezza giornata) · *fatela comunque*
Togliere i dati personali dal repository. Seed anonimo o generato. Chiude il rischio
descritto al §6 e non costa quasi niente.

### Fase 1 — Chiudere i bug noti (2–3 giorni)
I 7 del §4. Quattro sono meccanici (mezz'ora l'uno con test). Due sono funzioni da
costruire: **modifica e cancellazione del cedolino** (~2 h) e **due schede aperte**
(~2 h, e rischioso). Aggiungere un'asserzione di `stress` per ciascuno.

### Fase 2 — Setacciare le sei aree scoperte (3–5 giorni)
§5, con il metodo che ha funzionato: agenti che riproducono + verificatore ostile.
Aspettarsi altri 10–20 risultati, di cui una manciata gravi.

### Fase 3 — Farla usare a una seconda persona (2–4 settimane)
**È il passo che conta più di tutti.** Togliere il seed, generalizzare i casi speciali
legati a una casa, scrivere l'accoglienza e gli stati vuoti, dare un nome ai
concetti per chi non li conosce.

Un amico o un fratello che la usa per un pomeriggio dice in poche ore quello che sei
mesi di supposizioni non direbbero.

### Fase 4 — Prodotto vero in Italia (4–6 mesi)
Account, sincronizzazione, backup, uscita dal limite del localStorage, CI, licenza,
privacy policy, assistenza. E la questione regolatoria del §6 da risolvere **prima**
di pubblicare.

### Fase 5 — «Globale» — non è un progetto, è un'azienda
Ogni paese ha il suo fisco: il 730 non esiste altrove, l'IMU nemmeno, Fon.Te è
italiano, i CSV PSD2 cambiano banca per banca. Ogni nazione è un modulo fiscale da
scrivere **e mantenere**. Non stimabile come progetto singolo.

---

## 9. Come lavorare su questo progetto

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # tsc --noEmit
npm run stress       # oltre mille controlli — DEVE passare prima di ogni commit
npm run build
npm run dev:telefono # stesso, raggiungibile dal telefono in rete, senza dati privati (vedi README)
```

### Dove sono le cose

| File | Contiene |
|---|---|
| `src/lib/quadra.ts` | modello dati, SEED, cedolini, equity, competenza |
| `src/lib/store.ts` | Zustand + persist, hydrate difensivo, tutte le azioni |
| `src/lib/banca.ts` | parsing CSV, classificazione, V |
| `src/lib/casa.ts` | immobili, rendimenti, leva, 730 |
| `src/lib/affare.ts` | matematica di Investi (rata, NOI, voti, scenari) |
| `src/lib/fonte.ts` | Fon.Te, parsing PDF/CSV |
| `src/lib/prezzi.ts` | prezzi live crypto/azioni, cascata + cache |
| `src/lib/mercato.ts` | indici di mercato (Eurostat, Alpha Vantage), registro fonti |
| `src/components/giudizio.tsx` | indicatore Buono / Nella media / Sotto la media |
| `src/components/info.tsx` | tondino «i» e riquadro, con rientro dai bordi |
| `src/lib/investi.ts` | Investi dopo il 25/9: rata vera, debito negli anni, tre scenari |
| `src/lib/profilo.ts` | «dati su questo telefono» / «vuota»: quale salvataggio è attivo |
| `src/lib/nomi.ts` | nomi delle voci e testi delle «i», in un posto solo |
| `scripts/stress.mts` | i controlli, l'unica rete di sicurezza (dati finti da `fixture-demo.ts`) |
| `scripts/dividi.mjs` | la copia pulita da pubblicare, vedi §11 |

### Convenzioni

- **Commit in italiano**, che spiegano *perché*, non *cosa*. Il messaggio racconta il
  caso concreto: input, numero sbagliato, numero giusto.
- **Ogni bug corretto porta la sua asserzione** in `scripts/stress.mts`.
- `src/routeTree.gen.ts` è generato: non committare il rumore di formattazione.
- I file sono **CRLF**: le modifiche via script devono preservarlo.
- **Verificare nel browser vero**, non solo col typecheck. Molti bug (riquadri fuori
  schermo, importi non nascosti, salvataggio silenzioso) si vedono solo così.

### Il metodo con gli agenti

1. Un agente per area, **in sola lettura**, che deve *riprodurre* con `npx tsx`.
2. Un verificatore ostile per area, istruito a **smontare**: in dubbio si scarta.
3. Le correzioni le applica il modello principale, non gli agenti — così non
   confliggono fra loro.
4. Tenere sotto i ~14 agenti per giro: oltre, il limite di sessione li uccide.

---

## 10. In una frase

Ledger dice tre numeri che le banche mescolano — **quanto resta**, **quanto è tuo**,
**quanto rende** — con i cedolini e il CSV di chi lo usa, non con esempi da influencer.

Oggi lo fa bene per una persona. Il salto non è tecnico: è passare da *un attrezzo che
conosce te* a *un attrezzo che conosce chiunque*. E il primo passo di quel salto non è
scrivere codice, è **farlo usare a qualcun altro per un pomeriggio**.

---

## 11. Ultimo passo: dividere il repository

> ✅ **Fatto il 9 ottobre 2026**: copia in `Documents\ledger-pubblico`, su GitHub come
> `Cala9165/ledger-app` (pubblico). Per aggiornarla dopo nuovo lavoro: commit qui,
> `npm run dividi -- --prova`, poi copiare i file cambiati in `ledger-pubblico` e fare lì un
> commit normale (niente `--force`: la storia della copia pubblica è pulita da sola).

Si fa **per ultimo**, quando il lavoro è finito e committato. Il codice di oggi è pulito,
ma la storia git di sviluppo può contenere dati tolti dopo. Pubblicare quel repository
vorrebbe dire pubblicare anche quella storia.

Quindi non si pubblica questo: se ne fa una **copia nuova, con un solo commit**.

```bash
npm run dividi -- --prova                # solo controlli, non crea niente
node scripts/dividi.mjs ../ledger-pubblico
```

Cosa fa lo script:

- con `--prova` controlla tutti i file (anche quelli non ancora committati) e si ferma se
  trova `src/private/`, un `.env` o una delle parole personali;
- senza `--prova` vuole il lavoro tutto committato, copia solo i file dell'ultimo commit
  in una cartella vuota, fa `git init` e **un solo commit** «Ledger»;
- non crea niente su GitHub e non fa push.

Le parole personali (nomi, vie, negozi, importi precisi) stanno in `src/private/termini.txt`,
che git ignora: se ne scopri una nuova, aggiungila lì prima di rilanciare.

Il commit della copia va firmato con l'indirizzo anonimo di GitHub del proprio account
(`ID+utente@users.noreply.github.com`, in GitHub → Settings → Emails), non con
l'identità git di questo computer. Si passa così (da Git Bash):

```bash
LEDGER_AUTORE="Nome" LEDGER_EMAIL="indirizzo" node scripts/dividi.mjs ../ledger-pubblico
```

Poi, a mano:

1. Guarda la copia. In particolare questo documento: racconta la storia del progetto e
   potresti non volerlo pubblico (basta toglierlo dalla copia e rifare il commit).
2. Crea su GitHub un repository **nuovo**. Non riusare quello vecchio: la storia
   resterebbe raggiungibile.
3. Nella copia: `git remote add origin <indirizzo>` e `git push -u origin main`.
4. Il repository vecchio resta **privato**: è l'archivio, con tutta la storia.

Da lì in poi si lavora su quale dei due? Sul nuovo. `src/private/` non c'è (è ignorato):
per avere i propri dati in sviluppo basta copiarci dentro la cartella dal vecchio.
