import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, Home, Palmtree, PieChart } from "lucide-react";
import type { ReactNode } from "react";
import { create } from "zustand";
import { ConfrontoCasa } from "@/components/confronto-casa";
import { ElencoCosti } from "@/components/costi";
import { PercentualeVoto } from "@/components/giudizio";
import { Info } from "@/components/info";
import { DatoMercato } from "@/components/mercato";
import { AccordionGroup, AccordionItem } from "@/components/ui/accordion";
import { Card, Cifra } from "@/components/ui/card";
import { Input, Label, NumberField } from "@/components/ui/input";
import { todayIso } from "@/lib/banca";
import {
  costoAffittoMese,
  costoPieno,
  costoPossessoMese,
  debitoCasa,
  fissaMutuoDi,
  speseCasa,
  valoreEffettivo,
  withImmobile,
} from "@/lib/casa";
import {
  IPOTESI_BASE,
  analizzaAbito,
  analizzaAffitto,
  analizzaCapitale,
  costoAnno,
  type Costo,
  type Debito,
  type Ipotesi,
  type OrigineRata,
  type Scenario,
} from "@/lib/investi";
import { VOCI } from "@/lib/nomi";
import { pagellaInvestimento } from "@/lib/pagelle";
import { fissaConPiano, pianoDi, rataDi, rateFuture } from "@/lib/piano";
import { VOCI_INQUILINO, competenzaMese, type Immobile } from "@/lib/quadra";
import { useQuadra } from "@/lib/store";
import { cn, money, pct, periodoLeggibile, plurale } from "@/lib/utils";

export const Route = createFileRoute("/investi")({ component: InvestiPage });

type Percorso = "abito" | "affitto" | "turisti" | "altro";

type Bozza = {
  /** null = non ancora scelta (vale la prima casa che hai); "" = una casa che non hai ancora. */
  casaId: string | null;
  prezzo: number;
  valore: number;
  canoneMese: number;
  tariffaNotte: number;
  occupazione: number;
  gestionePct: number;
  affittoAltrove: number;
  costi: Costo[];
  debito: Debito;
  ipotesi: Ipotesi;
  capitale: number;
  rendimento: number;
  calo: number;
  nomeCapitale: string;
};

const BOZZA: Bozza = {
  casaId: null,
  prezzo: 0,
  valore: 0,
  canoneMese: 0,
  tariffaNotte: 0,
  occupazione: 0,
  gestionePct: 0,
  affittoAltrove: 0,
  costi: [],
  debito: { residuo: 0, tan: 0, fine: "", rata: 0 },
  ipotesi: IPOTESI_BASE,
  capitale: 0,
  rendimento: 0,
  calo: 0,
  nomeCapitale: "",
};

type Stato = {
  percorso: Percorso | null;
  /** Una bozza per domanda: i costi di una casa non finiscono nel conto di un fondo. */
  per: Record<Percorso, Bozza>;
  vai: (p: Percorso | null) => void;
  patch: (p: Percorso, x: Partial<Bozza>) => void;
};

/** Resta finché l'app è aperta: passare da una pagina all'altra non cancella i conti. */
const useStato = create<Stato>((set) => ({
  percorso: null,
  per: { abito: BOZZA, affitto: BOZZA, turisti: BOZZA, altro: BOZZA },
  vai: (percorso) => set({ percorso }),
  patch: (p, x) => set((s) => ({ per: { ...s.per, [p]: { ...s.per[p], ...x } } })),
}));

function useBozza() {
  const s = useStato();
  const p: Percorso = s.percorso ?? "abito";
  return { ...s.per[p], set: (x: Partial<Bozza>) => s.patch(p, x) };
}

const SCELTE: { id: Percorso; titolo: string; sotto: string; icon: typeof Home }[] = [
  { id: "abito", titolo: "Ci abito", sotto: "Mi conviene stare lì o andare in affitto?", icon: Home },
  { id: "affitto", titolo: "La affitto tutto l'anno", sotto: "Quanto mi resta davvero dall'affitto?", icon: Building2 },
  { id: "turisti", titolo: "La affitto a turisti", sotto: "Notti, pulizie, piattaforme: regge?", icon: Palmtree },
  { id: "altro", titolo: "È un investimento che non è una casa", sotto: "Fondo, azioni, altro", icon: PieChart },
];

function InvestiPage() {
  const percorso = useStato((s) => s.percorso);
  const vai = useStato((s) => s.vai);
  if (!percorso) {
    return (
      <div className="flex flex-col gap-4">
        <div className="px-1">
          <h1 className="text-2xl font-semibold">Investi</h1>
          <p className="mt-1 text-[15px] text-muted">Cosa vuoi capire?</p>
        </div>
        {SCELTE.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => vai(s.id)}
              className="flex min-h-20 items-center gap-4 rounded-3xl bg-surface p-5 text-left shadow-[var(--shadow-card)]"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-pine-2 text-pine">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold">{s.titolo}</span>
                <span className="mt-0.5 block text-sm text-muted">{s.sotto}</span>
              </span>
            </button>
          );
        })}
        <p className="px-1 text-xs text-muted">
          Sono conti, non consigli: i numeri li metti tu, l'app fa le somme anche quando la risposta non piace.
        </p>
      </div>
    );
  }
  const scelta = SCELTE.find((s) => s.id === percorso)!;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => vai(null)}
          aria-label="Cambia domanda"
          className="flex size-11 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-border)]"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="text-xs text-muted">Investi</p>
          <h1 className="truncate text-xl font-semibold">{scelta.titolo}</h1>
        </div>
      </div>
      {percorso === "altro" ? <PercorsoCapitale /> : <PercorsoCasa key={percorso} percorso={percorso} />}
    </div>
  );
}

function caseAdatte(immobili: Immobile[], percorso: Exclude<Percorso, "altro">): Immobile[] {
  return immobili.filter((i) => (percorso === "abito" ? i.uso !== "affitto" : true));
}

/** La casa di cui si parla: quella scelta, oppure la prima che hai già (niente acquisto da riscrivere). */
function casaScelta(immobili: Immobile[], percorso: Exclude<Percorso, "altro">, casaId: string | null) {
  const adatte = caseAdatte(immobili, percorso);
  if (casaId === null) return adatte[0];
  return adatte.find((i) => i.id === casaId);
}

function SceltaCasa({ percorso }: { percorso: Exclude<Percorso, "altro"> }) {
  const { immobili } = useQuadra();
  const b = useBozza();
  const adatte = caseAdatte(immobili, percorso);
  const attuale = casaScelta(immobili, percorso, b.casaId);
  if (!adatte.length) return null;
  return (
    <div>
      <p className="mb-1.5 px-1 text-sm text-muted">Quale casa?</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {adatte.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => b.set({ casaId: i.id })}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
              attuale?.id === i.id ? "bg-ink text-white" : "bg-surface shadow-[var(--shadow-border)]",
            )}
          >
            {i.nome || "Senza nome"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => b.set({ casaId: "" })}
          className={cn(
            "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
            !attuale ? "bg-ink text-white" : "bg-surface shadow-[var(--shadow-border)]",
          )}
        >
          Una casa che non ho ancora
        </button>
      </div>
    </div>
  );
}

function PercorsoCasa({ percorso }: { percorso: Exclude<Percorso, "altro"> }) {
  const { immobili } = useQuadra();
  const b = useBozza();
  const casa = casaScelta(immobili, percorso, b.casaId);
  return (
    <>
      <SceltaCasa percorso={percorso} />
      {percorso === "abito" ? (
        casa ? (
          <AbitoEsistente key={casa.id} casa={casa} />
        ) : (
          <AbitoNuova />
        )
      ) : (
        <Affitto key={casa?.id ?? "nuova"} casa={casa} turisti={percorso === "turisti"} />
      )}
    </>
  );
}

/** Ci abito, casa già in Casa: stessi numeri e stesso confronto della scheda Casa. */
function AbitoEsistente({ casa }: { casa: Immobile }) {
  const { patrimonio, fisse, updateImmobile, nascostoSaldo: hidden } = useQuadra();
  const p = withImmobile(patrimonio, casa);
  const own = costoPossessoMese(p, casa, fisse);
  const rent = costoAffittoMese(p, casa, fisse);
  const mutuo = fissaMutuoDi(casa, fisse);
  const rataMese = mutuo ? competenzaMese(fissaConPiano(mutuo, todayIso())) : 0;
  const imuAnno = speseCasa(casa, fisse)
    .filter((r) => r.voce === "imu")
    .reduce((s, r) => s + r.mese * 12, 0);
  return (
    <>
      <Card>
        <Label htmlFor="ab-aff">Affitto di una casa così, in zona (€ al mese)</Label>
        <NumberField
          id="ab-aff"
          value={casa.affittoEq}
          digits={0}
          min={0}
          emptyCommitsZero
          onCommit={(n) => updateImmobile(casa.id, { affittoEq: n })}
        />
        <p className="mt-2 text-xs text-muted">
          Il resto (mutuo, spese, 730) arriva dalla scheda in{" "}
          <Link to="/casa" className="text-pine underline">
            Casa
          </Link>
          .
        </p>
      </Card>
      <Card>
        <p className="mb-3 text-sm font-semibold">{VOCI_CONVIENE}</p>
        <ConfrontoCasa
          esceProprietario={rataMese + own.spese}
          esceAffitto={casa.affittoEq > 0 ? rent.totale : 0}
          parteTua={Math.max(0, valoreEffettivo(p) - debitoCasa(casa, fisse))}
          imuAnno={imuAnno}
          recupero730Anno={own.recupero * 12}
          costoVeroMese={own.netto}
          affittoMese={casa.affittoEq > 0 ? rent.totale : 0}
          hidden={hidden}
          dettaglio={
            <p className="text-xs text-muted">
              Costo vero al mese: interessi {money(own.interessi, hidden, 0)} + spese {money(own.spese, hidden, 0)} +
              manutenzione {money(own.manutenzione, hidden, 0)} − {money(own.recupero, hidden, 0)} dal 730.
            </p>
          }
        />
      </Card>
    </>
  );
}

const VOCI_CONVIENE = "Conviene tenerti la casa o andare in affitto?";

function AbitoNuova() {
  const b = useBozza();
  const { nascostoSaldo: hidden } = useQuadra();
  const e = analizzaAbito({ costi: b.costi, debito: b.debito, affittoAltrove: b.affittoAltrove, prezzo: b.prezzo });
  const imuAnno = b.costi.filter((c) => /\bimu\b/i.test(c.nome)).reduce((s, c) => s + costoAnno(c), 0);
  return (
    <>
      <AccordionGroup iniziale="acquisto">
        <AccordionItem id="acquisto" titolo="Acquisto" sotto={b.prezzo > 0 ? money(b.prezzo, hidden, 0) : "Prezzo"}>
          <div className="pt-2">
            <Label htmlFor="an-prezzo">Prezzo €</Label>
            <NumberField id="an-prezzo" value={b.prezzo} digits={0} min={0} emptyCommitsZero onCommit={(n) => b.set({ prezzo: n })} />
            <p className="mt-1 text-xs text-muted">Notaio e imposte mettili fra i costi, come «Una volta».</p>
          </div>
        </AccordionItem>
        <AccordionItem id="costi" titolo="Costi della casa" sotto="Condominio, IMU, bollette, manutenzione">
          <ElencoCosti
            costi={b.costi}
            onChange={(c) => b.set({ costi: c })}
            hidden={hidden}
            conAffitto
            suggerimenti={["Condominio", "IMU", "TARI", "Assicurazione", "Manutenzione", "Notaio"]}
          />
        </AccordionItem>
        <AccordionItem id="debito" titolo="Mutuo" sotto={b.debito.residuo > 0 ? money(b.debito.residuo, hidden, 0) : "Nessuno"}>
          <CampiDebito />
        </AccordionItem>
        <AccordionItem
          id="affitto"
          titolo="Affitto altrove"
          sotto={b.affittoAltrove > 0 ? `${money(b.affittoAltrove, hidden, 0)} al mese` : "Quanto pagheresti"}
        >
          <div className="pt-2">
            <Label htmlFor="an-aff">Affitto di una casa simile € al mese</Label>
            <NumberField id="an-aff" value={b.affittoAltrove} digits={0} min={0} emptyCommitsZero onCommit={(n) => b.set({ affittoAltrove: n })} />
            <p className="mt-1 text-xs text-muted">Le bollette segnate «anche in affitto» le aggiungo io.</p>
          </div>
        </AccordionItem>
      </AccordionGroup>
      <NotaRata origine={e.origineRata} residuo={b.debito.residuo} />
      <Card>
        <p className="mb-3 text-sm font-semibold">{VOCI_CONVIENE}</p>
        <ConfrontoCasa
          esceProprietario={e.rataMese + e.costiMese}
          esceAffitto={b.affittoAltrove > 0 ? e.affittoMese : 0}
          parteTua={e.capitaleTuo}
          imuAnno={imuAnno}
          recupero730Anno={e.recupero730Mese * 12}
          costoVeroMese={e.costoMese}
          affittoMese={b.affittoAltrove > 0 ? e.affittoMese : 0}
          hidden={hidden}
          dettaglio={
            <p className="text-xs text-muted">
              Costo vero al mese: interessi {money(e.interessiMese, hidden, 0)} + costi {money(e.costiMese, hidden, 0)} −{" "}
              {money(e.recupero730Mese, hidden, 0)} dal 730.
              {e.unaTantum > 0 ? ` In più, una volta sola: ${money(e.unaTantum, hidden, 0)}.` : ""}
            </p>
          }
        />
      </Card>
    </>
  );
}

function NotaRata({ origine, residuo }: { origine: OrigineRata; residuo: number }) {
  if (!(residuo > 0)) return null;
  if (origine === "solo-interessi")
    return (
      <p className="rounded-2xl bg-amber-2 p-3 text-sm text-amber">
        Manca l'ultima rata: conto solo gli interessi. Scrivi la rata o la scadenza del mutuo.
      </p>
    );
  if (origine === "nessuna")
    return (
      <p className="rounded-2xl bg-amber-2 p-3 text-sm text-amber">
        Manca la rata del mutuo: scrivila, oppure il tasso e l'ultima rata.
      </p>
    );
  return null;
}

function CampiDebito({ bloccato }: { bloccato?: ReactNode }) {
  const b = useBozza();
  const d = b.debito;
  const set = (p: Partial<Debito>) => b.set({ debito: { ...d, ...p } });
  if (bloccato) return <>{bloccato}</>;
  return (
    <div className="grid grid-cols-2 gap-3 pt-2">
      <div>
        <Label htmlFor="d-res">Debito residuo €</Label>
        <NumberField id="d-res" value={d.residuo} digits={0} min={0} emptyCommitsZero onCommit={(n) => set({ residuo: n })} />
      </div>
      <div>
        <Label htmlFor="d-tan" className="flex items-center gap-1.5">
          {VOCI.tan.nome} % <Info voce="tan" />
        </Label>
        <NumberField
          id="d-tan"
          value={Math.round(d.tan * 10000) / 100}
          digits={2}
          min={0}
          max={30}
          emptyCommitsZero
          onCommit={(n) => set({ tan: n / 100 })}
        />
      </div>
      <div>
        <Label htmlFor="d-fine">Ultima rata</Label>
        <Input id="d-fine" type="month" value={d.fine} onChange={(e) => set({ fine: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="d-rata">Rata al mese € (se la sai)</Label>
        <NumberField id="d-rata" value={d.rata} digits={2} min={0} emptyCommitsZero onCommit={(n) => set({ rata: n })} />
      </div>
      <p className="col-span-2 text-xs text-muted">
        Senza la rata la calcolo io dal tasso e dall'ultima rata. Gli interessi sono un costo, la quota capitale no.
      </p>
    </div>
  );
}

function CampiIpotesi({ conSfitto }: { conSfitto: boolean }) {
  const b = useBozza();
  const ip = b.ipotesi;
  const set = (p: Partial<Ipotesi>) => b.set({ ipotesi: { ...ip, ...p } });
  const pc = (x: number) => Math.round(x * 1000) / 10;
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Label htmlFor="ip-infl" className="mb-0">{VOCI.inflazione.nome} %</Label>
            <Info voce="inflazione" />
          </div>
          <NumberField id="ip-infl" value={pc(ip.inflazione)} digits={1} min={-5} max={30} emptyCommitsZero onCommit={(n) => set({ inflazione: n / 100 })} />
        </div>
        {conSfitto ? (
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label htmlFor="ip-sfitto" className="mb-0">{VOCI.sfitto.nome} %</Label>
              <Info voce="sfitto" />
            </div>
            <NumberField id="ip-sfitto" value={pc(ip.sfitto)} digits={1} min={0} max={100} emptyCommitsZero onCommit={(n) => set({ sfitto: n / 100 })} />
          </div>
        ) : null}
        <div>
          <Label htmlFor="inv-campo-2">Se sale, % all'anno</Label>
          <NumberField id="inv-campo-2" value={pc(ip.su)} digits={1} min={-50} max={50} emptyCommitsZero onCommit={(n) => set({ su: n / 100 })} />
        </div>
        <div>
          <Label htmlFor="inv-campo-3">Se scende, % all'anno</Label>
          <NumberField id="inv-campo-3"
            value={pc(ip.giu)}
            digits={1}
            min={-50}
            max={0}
            emptyCommitsZero
            rangeMessage="Qui va un calo: un numero negativo, es. −5"
            onCommit={(n) => set({ giu: n / 100 })}
          />
        </div>
        <div>
          <Label htmlFor="inv-campo-4">Anni in cui la tieni</Label>
          <NumberField id="inv-campo-4" value={ip.anni} digits={0} min={1} max={50} emptyAsZero={false} onCommit={(n) => set({ anni: n })} />
        </div>
      </div>
      <DatoMercato misura="case" valoreAttuale={ip.su} onUsa={(x) => set({ su: x })} />
    </div>
  );
}

function Affitto({ casa, turisti }: { casa: Immobile | undefined; turisti: boolean }) {
  const { patrimonio, fisse, updateImmobile, nascostoSaldo: hidden } = useQuadra();
  const b = useBozza();
  const ordinario = !turisti;

  let prezzo = b.prezzo;
  let valore = b.valore;
  let debito = b.debito;
  let costiCasaAnno = 0;
  let canone = b.canoneMese;
  let bloccoDebito: ReactNode = null;
  if (casa) {
    const p = withImmobile(patrimonio, casa);
    prezzo = costoPieno(p);
    valore = valoreEffettivo(p);
    const mutuo = fissaMutuoDi(casa, fisse);
    const piano = pianoDi(mutuo);
    const oggi = todayIso();
    const r = rataDi(mutuo, oggi);
    debito = {
      residuo: debitoCasa(casa, fisse),
      tan: casa.mutuoTan ?? 0,
      fine: casa.mutuoFine || (piano ? piano[piano.length - 1].d.slice(0, 7) : ""),
      rata: mutuo ? competenzaMese(fissaConPiano(mutuo, oggi)) : 0,
      piano: piano ? rateFuture(piano) : undefined,
    };
    const escluse = ordinario ? VOCI_INQUILINO : new Set<string>();
    costiCasaAnno =
      speseCasa(casa, fisse)
        .filter((x) => !escluse.has(x.voce))
        .reduce((s, x) => s + x.mese * 12, 0) +
      valore * casa.manutenzionePct;
    canone = casa.affittoEq;
    const esito = analizzaAffitto({
      turisti,
      canoneMese: canone,
      tariffaNotte: b.tariffaNotte,
      occupazione: b.occupazione,
      gestionePct: b.gestionePct,
      costi: [],
      costiCasaAnno: 0,
      prezzo,
      valore,
      debito,
      ipotesi: b.ipotesi,
      esistente: true,
    });
    bloccoDebito = (
      <div className="pt-2 text-sm">
        {debito.residuo > 0 ? (
          <p className="tabular-nums">
            Debito {money(debito.residuo, hidden, 0)} · rata {money(esito.rataMese, hidden, 0)} al mese
            {debito.tan > 0 ? ` · tasso ${pct(debito.tan, 2)}` : ""}
            {debito.fine ? ` · ultima rata ${periodoLeggibile(debito.fine)}` : ""}
            {r ? ` · questo mese interessi ${money(r.i, hidden)} e capitale ${money(r.c, hidden)}` : ""}.
          </p>
        ) : (
          <p>Nessun mutuo su questa casa.</p>
        )}
        <p className="mt-1 text-xs text-muted">
          Arriva da{" "}
          <Link to="/casa" className="text-pine underline">
            Casa
          </Link>
          : si cambia lì.
        </p>
      </div>
    );
  }

  const e = analizzaAffitto({
    turisti,
    canoneMese: canone,
    tariffaNotte: b.tariffaNotte,
    occupazione: b.occupazione,
    gestionePct: b.gestionePct,
    costi: b.costi,
    costiCasaAnno,
    prezzo,
    valore,
    debito,
    ipotesi: b.ipotesi,
    esistente: !!casa,
  });
  const su = e.scenari.find((s) => s.id === "su")!;
  const giu = e.scenari.find((s) => s.id === "giu")!;
  const rateAnno = e.noi - e.avanzo;
  const suggerimenti = casa
    ? turisti
      ? ["Pulizie", "Biancheria", "Tassa di soggiorno", "Piccole riparazioni"]
      : ["Agenzia", "Registrazione del contratto", "Piccole riparazioni"]
    : turisti
      ? ["Notaio", "Imposte", "Arredo", "Pulizie", "Biancheria", "Condominio", "IMU"]
      : ["Notaio", "Imposte", "Condominio", "IMU", "Assicurazione", "Manutenzione"];

  return (
    <>
      <AccordionGroup iniziale={casa ? "ricavi" : "acquisto"}>
        {casa ? (
          <AccordionItem id="acquisto" titolo="Acquisto" sotto="Dalla scheda Casa" destra={<span className="font-medium">{money(prezzo, hidden, 0)}</span>}>
            <p className="pt-2 text-sm">
              Speso in tutto {money(prezzo, hidden, 0)}, vale oggi {money(valore, hidden, 0)}.
            </p>
            <p className="mt-1 text-xs text-muted">
              Si cambia in{" "}
              <Link to="/casa" className="text-pine underline">
                Casa
              </Link>
              : niente da riscrivere qui.
            </p>
          </AccordionItem>
        ) : (
          <AccordionItem id="acquisto" titolo="Acquisto" sotto={b.prezzo > 0 ? money(b.prezzo, hidden, 0) : "Prezzo e valore"}>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label htmlFor="n-prezzo">Prezzo €</Label>
                <NumberField id="n-prezzo" value={b.prezzo} digits={0} min={0} emptyCommitsZero onCommit={(n) => b.set({ prezzo: n })} />
              </div>
              <div>
                <Label htmlFor="n-val">{VOCI.valoreCasa.nome} oggi €</Label>
                <NumberField id="n-val" value={b.valore} digits={0} min={0} emptyCommitsZero onCommit={(n) => b.set({ valore: n })} />
              </div>
              <p className="col-span-2 text-xs text-muted">
                Notaio, imposte e lavori mettili fra i costi, come «Una volta»: si tolgono dal risultato, non fanno
                valere di più la casa. Senza il valore uso il prezzo.
              </p>
            </div>
          </AccordionItem>
        )}

        <AccordionItem
          id="ricavi"
          titolo={turisti ? "Notti e tariffe" : "Affitto"}
          sotto={e.ricavi > 0 ? `${money(e.ricavi, hidden, 0)} l'anno` : "Quanto incassi"}
        >
          {turisti ? (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label htmlFor="t-tar">Media a notte €</Label>
                <NumberField id="t-tar" value={b.tariffaNotte} digits={0} min={0} emptyCommitsZero onCommit={(n) => b.set({ tariffaNotte: n })} />
              </div>
              <div>
                <Label htmlFor="t-occ">Notti occupate %</Label>
                <NumberField
                  id="t-occ"
                  value={Math.round(b.occupazione * 1000) / 10}
                  digits={0}
                  min={0}
                  max={100}
                  emptyCommitsZero
                  onCommit={(n) => b.set({ occupazione: n / 100 })}
                />
              </div>
              <div>
                <Label htmlFor="t-ges">Piattaforme e gestione %</Label>
                <NumberField
                  id="t-ges"
                  value={Math.round(b.gestionePct * 1000) / 10}
                  digits={0}
                  min={0}
                  max={100}
                  emptyCommitsZero
                  onCommit={(n) => b.set({ gestionePct: n / 100 })}
                />
              </div>
              <p className="col-span-2 text-xs text-muted">
                Media di tutto l'anno, bassa stagione compresa. 55 % vuol dire circa 200 notti.
              </p>
            </div>
          ) : (
            <div className="pt-2">
              <Label htmlFor="o-can">Affitto € al mese</Label>
              <NumberField
                id="o-can"
                value={canone}
                digits={0}
                min={0}
                emptyCommitsZero
                onCommit={(n) => (casa ? updateImmobile(casa.id, { affittoEq: n }) : b.set({ canoneMese: n }))}
              />
              <p className="mt-1 text-xs text-muted">I mesi vuoti li metti nelle ipotesi, alla voce sfitto.</p>
            </div>
          )}
        </AccordionItem>

        <AccordionItem id="costi" titolo="Costi" sotto={`${money(e.costiAnno, hidden, 0)} l'anno`}>
          {casa ? (
            <p className="pt-2 text-sm text-muted">
              Dalla scheda Casa: {money(costiCasaAnno, hidden, 0)} l'anno (spese della casa{ordinario ? " che restano a te" : ""} e
              manutenzione). Qui sotto aggiungi quelli che mancano.
            </p>
          ) : null}
          <div className="pt-2">
            <ElencoCosti costi={b.costi} onChange={(c) => b.set({ costi: c })} hidden={hidden} suggerimenti={suggerimenti} />
          </div>
        </AccordionItem>

        <AccordionItem id="debito" titolo="Mutuo" sotto={debito.residuo > 0 ? `${money(e.rataMese, hidden, 0)} al mese` : "Nessuno"}>
          <CampiDebito bloccato={bloccoDebito} />
        </AccordionItem>

        <AccordionItem
          id="ipotesi"
          titolo="Ipotesi sul futuro"
          sotto={`${plurale(b.ipotesi.anni, "anno", "anni")} · sale ${pct(b.ipotesi.su)} · scende ${pct(b.ipotesi.giu)}`}
        >
          <CampiIpotesi conSfitto={ordinario} />
        </AccordionItem>
      </AccordionGroup>

      <NotaRata origine={e.origineRata} residuo={debito.residuo} />

      {!e.pronto ? (
        <Card>
          <p className="text-sm text-muted">
            {casa ? "Serve almeno quanto incassi." : "Servono almeno il prezzo e quanto incassi."} Senza, qualunque giudizio sarebbe inventato.
          </p>
        </Card>
      ) : (
        <>
          <Card tono="scuro">
            <p className="text-sm text-white/70">Ti resta in tasca, il primo anno</p>
            <Cifra size="2xl" className={e.avanzo < 0 ? "text-[#ff9b8f]" : ""}>
              {money(e.avanzo, hidden, 0)}
            </Cifra>
            <p className="mt-1 text-sm text-white/75">
              Incassi {money(e.ricavi, hidden, 0)} − costi {money(e.costiAnno, hidden, 0)} − rate {money(rateAnno, hidden, 0)}
            </p>
            {e.unaTantum > 0 ? (
              <p className="mt-1 text-xs text-white/60">In più, una volta sola all'inizio: {money(e.unaTantum, hidden, 0)}.</p>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3">
              <div>
                <p className="text-sm">Se il valore sale come pensi</p>
                <p className="text-xs text-white/60">affitto netto + rialzo, all'anno</p>
              </div>
              <PercentualeVoto pagella={pagellaInvestimento(su.anno, true)} />
            </div>
            <p className="mt-3 text-sm text-white/85">{avvertenza(e.avanzo, giu, e.netto, hidden)}</p>
          </Card>
          <Scenari scenari={e.scenari} anni={b.ipotesi.anni} hidden={hidden} />
        </>
      )}
    </>
  );
}

function avvertenza(avanzo: number, giu: Scenario, netto: number, hidden: boolean): string {
  if (avanzo < 0) return `La rata si mangia l'affitto: il primo anno ci metti ${money(-avanzo, hidden, 0)} di tasca tua.`;
  if (giu.dopoAnni < 0) return "Se il valore scende ci perdi: regge solo se il prezzo tiene.";
  if (netto < 0.03) return `Solo il ${pct(netto)} arriva dall'affitto: il resto è un'ipotesi sul prezzo.`;
  return `Regge anche col valore fermo: il ${pct(netto)} arriva dall'affitto, che non dipende da previsioni.`;
}

function Scenari({ scenari, anni, hidden }: { scenari: Scenario[]; anni: number; hidden: boolean }) {
  return (
    <div>
      <p className="mb-2 px-1 text-sm text-muted">
        Tre scenari. Le cifre in euro sono in soldi di oggi: l'inflazione è già tolta.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {scenari.map((s) => (
          <div key={s.id} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
            <p className="text-xs leading-tight text-muted">{s.label}</p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", s.anno < 0 && "text-brick")}>{pct(s.anno)}</p>
            <p className="text-[11px] text-muted">all'anno</p>
            <p className={cn("mt-2 text-sm font-medium tabular-nums", s.dopoAnni < 0 && "text-brick")}>
              {s.dopoAnni >= 0 ? "+" : "−"}
              {money(Math.abs(s.dopoAnni), hidden, 0)}
            </p>
            <p className="text-[11px] leading-tight text-muted">in {plurale(anni, "anno", "anni")}, circa</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PercorsoCapitale() {
  const b = useBozza();
  const { investimenti, nascostoSaldo: hidden } = useQuadra();
  const e = analizzaCapitale({ capitale: b.capitale, rendimento: b.rendimento, calo: b.calo, costi: b.costi, ipotesi: b.ipotesi });
  return (
    <>
      {investimenti.length ? (
        <div>
          <p className="mb-1.5 px-1 text-sm text-muted">Parti da uno che hai già</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {investimenti.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => b.set({ nomeCapitale: i.nome, capitale: i.valore })}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                  b.nomeCapitale === i.nome ? "bg-ink text-white" : "bg-surface shadow-[var(--shadow-border)]",
                )}
              >
                {i.nome}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <AccordionGroup iniziale="dati">
        <AccordionItem id="dati" titolo="L'investimento" sotto={b.capitale > 0 ? money(b.capitale, hidden, 0) : "Quanto e quanto rende"}>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="col-span-2">
              <Label htmlFor="k-nome">Cos'è</Label>
              <Input id="k-nome" value={b.nomeCapitale} placeholder="Es. Fondo azionario mondo" onChange={(ev) => b.set({ nomeCapitale: ev.target.value })} />
            </div>
            <div>
              <Label htmlFor="k-cap">Quanto ci metti €</Label>
              <NumberField id="k-cap" value={b.capitale} digits={0} min={0} emptyCommitsZero onCommit={(n) => b.set({ capitale: n })} />
            </div>
            <div>
              <Label htmlFor="k-rend">Quanto pensi che renda % all'anno</Label>
              <NumberField
                id="k-rend"
                value={Math.round(b.rendimento * 1000) / 10}
                digits={1}
                min={-50}
                max={100}
                emptyCommitsZero
                onCommit={(n) => b.set({ rendimento: n / 100 })}
              />
            </div>
            <div>
              <Label htmlFor="k-calo">In un anno brutto perde %</Label>
              <NumberField
                id="k-calo"
                value={Math.round(b.calo * 1000) / 10}
                digits={1}
                min={0}
                max={100}
                emptyCommitsZero
                onCommit={(n) => b.set({ calo: n / 100 })}
              />
            </div>
            <div className="col-span-2">
              <DatoMercato misura="azioni" valoreAttuale={b.rendimento} onUsa={(x) => b.set({ rendimento: x })} />
            </div>
          </div>
        </AccordionItem>
        <AccordionItem id="costi" titolo="Costi" sotto={`${money(e.costiAnno, hidden, 0)} l'anno`}>
          <ElencoCosti
            costi={b.costi}
            onChange={(c) => b.set({ costi: c })}
            hidden={hidden}
            suggerimenti={["Commissioni del fondo", "Conto titoli", "Imposta di bollo", "Costo di ingresso"]}
          />
        </AccordionItem>
        <AccordionItem id="ipotesi" titolo="Ipotesi" sotto={`${plurale(b.ipotesi.anni, "anno", "anni")} · inflazione ${pct(b.ipotesi.inflazione)}`}>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <Label htmlFor="inv-campo-1" className="mb-0">
                  {VOCI.inflazione.nome} %
                </Label>
                <Info voce="inflazione" />
              </div>
              <NumberField
                id="inv-campo-1"
                value={Math.round(b.ipotesi.inflazione * 1000) / 10}
                digits={1}
                min={-5}
                max={30}
                emptyCommitsZero
                onCommit={(n) => b.set({ ipotesi: { ...b.ipotesi, inflazione: n / 100 } })}
              />
            </div>
            <div>
              <Label htmlFor="inv-campo-5">Anni in cui lo tieni</Label>
              <NumberField id="inv-campo-5"
                value={b.ipotesi.anni}
                digits={0}
                min={1}
                max={50}
                emptyAsZero={false}
                onCommit={(n) => b.set({ ipotesi: { ...b.ipotesi, anni: n } })}
              />
            </div>
          </div>
        </AccordionItem>
      </AccordionGroup>
      {!e.pronto ? (
        <Card>
          <p className="text-sm text-muted">Scrivi quanto ci metti: su zero euro ogni giudizio sarebbe inventato.</p>
        </Card>
      ) : (
        <>
          <Card tono="scuro">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/70">Se rende come pensi, tolti i costi</p>
                <p className="text-xs text-white/60">all'anno</p>
              </div>
              <PercentualeVoto pagella={pagellaInvestimento(e.nettoAtteso, b.rendimento !== 0, "capitale")} />
            </div>
            <p className="mt-3 text-sm text-white/85">
              {b.rendimento === 0
                ? "Scrivi quanto pensi che renda: senza, il voto sarebbe inventato."
                : b.calo > 0.3
                  ? `Per incassarlo devi restare fermo mentre perdi il ${pct(b.calo, 0)}. La domanda non è se rende: è se ci riesci.`
                  : b.rendimento > 0.15
                    ? "Un rendimento così alto non è una previsione, è una speranza."
                    : "Il rendimento è un'ipotesi tua: quello che controlli davvero sono i costi e il tempo."}
            </p>
            {e.unaTantum > 0 ? (
              <p className="mt-1 text-xs text-white/60">
                Costi una volta sola ({money(e.unaTantum, hidden, 0)}) già tolti dalle cifre in euro.
              </p>
            ) : null}
          </Card>
          <Scenari scenari={e.scenari} anni={b.ipotesi.anni} hidden={hidden} />
          <p className="px-1 text-xs text-muted">
            «Un anno brutto prima di vendere»: rende come pensi, poi l'ultimo anno perde il {pct(b.calo, 0)}. È il momento
            peggiore per aver bisogno dei soldi.
          </p>
        </>
      )}
    </>
  );
}

