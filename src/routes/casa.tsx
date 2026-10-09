import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CasaWizard } from "@/components/casa-wizard";
import { ConfrontoCasa } from "@/components/confronto-casa";
import { PercentualeVoto } from "@/components/giudizio";
import { Etichetta, Info } from "@/components/info";
import { DatoMercato } from "@/components/mercato";
import { ModuloFissa } from "@/components/modulo-fissa";
import { AccordionGroup, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, Cifra, Riga, Segmenti, Vuoto } from "@/components/ui/card";
import { Input, Label, NumberField, parseNumberDraft } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { todayIso } from "@/lib/banca";
import {
  anticipo,
  bonusQuoteRimanenti,
  capexDetraibile,
  debitoCasa,
  interessiAnno,
  cassaInvestita,
  costoAffittoMese,
  costoPieno,
  costoPossessoMese,
  equityCasa,
  fissaMutuoDi,
  fonteValore,
  pascalLeva,
  plusvalenza,
  recupero730Anno,
  speseCasa,
  valoreEffettivo,
  withImmobile,
  yieldNetto,
  yieldOnCost,
} from "@/lib/casa";
import { VOCI } from "@/lib/nomi";
import { pagellaCredito, pagellaLeva, pagellaRendimento, pagellaRendimentoNetto } from "@/lib/pagelle";
import { competenzaMese, USI_IMMOBILE, VOCI_CASA, type Fissa, type Immobile, type SpesaAcquisto, type VoceCasa } from "@/lib/quadra";
import { fissaConPiano, hasPiano, rataDi } from "@/lib/piano";
import { useQuadra } from "@/lib/store";
import { nuovoId } from "@/lib/id";
import { cn, eur, money, pct, plurale } from "@/lib/utils";

export const Route = createFileRoute("/casa")({ component: CasaPage });

function CasaPage() {
  const { immobili, immobileSelezionatoId, selectImmobile } = useQuadra();
  const [wizard, setWizard] = useState(false);
  const sel = immobili.find((i) => i.id === immobileSelezionatoId) ?? immobili[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="text-2xl font-semibold">Casa</h1>
        <Button variant="primary" size="sm" onClick={() => setWizard(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Aggiungi
        </Button>
      </div>

      {immobili.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Le tue case">
          {immobili.map((i) => (
            <button
              key={i.id}
              type="button"
              role="tab"
              aria-selected={i.id === sel?.id}
              onClick={() => selectImmobile(i.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                i.id === sel?.id ? "bg-ink text-white" : "bg-surface shadow-[var(--shadow-border)]",
              )}
            >
              {i.nome || "Senza nome"}
            </button>
          ))}
        </div>
      ) : null}

      {!sel ? (
        <Vuoto
          azione={
            <Button variant="primary" onClick={() => setWizard(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Aggiungi una casa
            </Button>
          }
        >
          Nessuna casa. Se vivi in affitto va bene così: la Home funziona lo stesso.
        </Vuoto>
      ) : (
        <SchedaCasa key={sel.id} casa={sel} />
      )}

      {wizard ? (
        <CasaWizard
          onClose={() => setWizard(false)}
          onCreata={(id) => {
            selectImmobile(id);
            setWizard(false);
          }}
        />
      ) : null}
    </div>
  );
}

function SchedaCasa({ casa }: { casa: Immobile }) {
  const { patrimonio, fisse, updateImmobile, nascostoSaldo: hidden } = useQuadra();
  const patch = (x: Partial<Immobile>) => updateImmobile(casa.id, x);
  const p = withImmobile(patrimonio, casa);
  const v = valoreEffettivo(p);
  const fonte = fonteValore(p);
  const tua = equityCasa(p);
  const mutuo = fissaMutuoDi(casa, fisse);
  const righe = speseCasa(casa, fisse);
  const speseMese = righe.reduce((s, r) => s + r.mese, 0);
  const own = costoPossessoMese(p, casa, fisse);
  const rent = costoAffittoMese(p, casa, fisse);
  const pieno = costoPieno(p);
  const leva = pascalLeva(p, casa);
  const abita = casa.uso !== "affitto";
  const affitta = casa.uso !== "abito";
  const rataMese = mutuo ? competenzaMese(fissaConPiano(mutuo, todayIso())) : 0;
  // Il voto sul credito solo se c'è davvero qualcosa da detrarre.
  const creditoAttivo = own.totale > 0 && (interessiAnno(casa, fisse) > 0 || capexDetraibile(p) > 0);

  return (
    <>
      <Card tono="scuro">
        <p className="text-sm text-white/70">
          {[casa.citta, USI_IMMOBILE.find((u) => u.id === casa.uso)?.label, casa.mq > 0 ? `${casa.mq} m²` : ""]
            .filter(Boolean)
            .join(" · ") || casa.nome}
        </p>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-white/70">
          {VOCI.valoreCasa.nome} <Info voce="valoreCasa" tono="scuro" />
        </p>
        <Cifra size="2xl">{v > 0 ? money(v, hidden, 0) : "—"}</Cifra>
        <p className="mt-1 text-sm text-white/80">
          {v > 0
            ? casa.capitaleMutuo > 0
              ? `Tolto il mutuo, la parte tua è ${money(tua, hidden, 0)}`
              : "Nessun mutuo: è tutta tua"
            : "Scrivi il prezzo pagato, oppure metri quadri e prezzo della zona."}
        </p>
        <p className="mt-3 text-xs text-white/60">
          {fonte === "mercato"
            ? "Valore scritto da te"
            : fonte === "mq"
              ? `Stima: ${casa.mq} m² × ${eur(casa.eurMqZona ?? 0, 0)} al m²`
              : fonte === "prezzo"
                ? "Uso il prezzo pagato: aggiungi il prezzo al m² della zona per una stima di oggi"
                : ""}
        </p>
      </Card>

      <AccordionGroup>
        <AccordionItem id="dati" titolo="Dati della casa" sotto={casa.nome}>
          <DatiCasa casa={casa} patch={patch} />
        </AccordionItem>

        <AccordionItem
          id="acquisto"
          titolo="Acquisto"
          sotto={casa.prezzoAcquisto > 0 ? `Pagata ${money(casa.prezzoAcquisto, hidden, 0)} nel ${casa.annoAcquisto}` : "Prezzo e spese di atto"}
          destra={<span className="font-medium">{money(pieno, hidden, 0)}</span>}
        >
          <Acquisto casa={casa} patch={patch} hidden={hidden} />
          {v > 0 && pieno > 0 ? (
            <p className="mt-3 text-sm text-muted">
              Se valesse davvero {money(v, hidden, 0)}, rispetto a quanto hai speso sei a{" "}
              <b className={plusvalenza(p) >= 0 ? "text-pine" : "text-brick"}>
                {plusvalenza(p) >= 0 ? "+" : ""}
                {money(plusvalenza(p), hidden, 0)}
              </b>
              .
            </p>
          ) : null}
          {cassaInvestita(p, mutuo) !== null ? (
            <p className="mt-1 text-sm text-muted">
              Di tasca tua finora ({mutuo || casa.capitaleMutuo > 0 ? "prezzo meno il prestito" : "il prezzo intero"}, spese,
              capitale del mutuo già restituito): <b className="text-ink">{money(cassaInvestita(p, mutuo) ?? 0, hidden, 0)}</b>
            </p>
          ) : null}
        </AccordionItem>

        <AccordionItem
          id="spese"
          titolo="Spese della casa"
          sotto={righe.length ? `${plurale(righe.length, "voce", "voci")} · nelle spese fisse` : "Condominio, IMU, bollette…"}
          destra={<span className="font-medium">{money(speseMese, hidden, 0)}</span>}
        >
          <SpeseCasa casa={casa} hidden={hidden} />
        </AccordionItem>

        <AccordionItem
          id="mutuo"
          titolo="Mutuo"
          sotto={debitoCasa(casa, fisse) > 0 ? `Devi ancora ${money(debitoCasa(casa, fisse), hidden, 0)}` : "Nessun mutuo"}
          destra={rataMese > 0 ? <span className="font-medium">{money(rataMese, hidden, 0)}</span> : undefined}
        >
          <Mutuo casa={casa} mutuo={mutuo} hidden={hidden} />
        </AccordionItem>

        {abita ? (
          <AccordionItem
            id="conviene"
            titolo="Conviene tenerti la casa o andare in affitto?"
            sotto={
              casa.affittoEq > 0
                ? rent.totale - own.netto >= 0
                  ? `Restando spendi ${money(rent.totale - own.netto, hidden, 0)} in meno al mese`
                  : `Restando spendi ${money(own.netto - rent.totale, hidden, 0)} in più al mese`
                : "Serve l'affitto di una casa simile"
            }
          >
            <Confronto casa={casa} hidden={hidden} rataMese={rataMese} patch={patch} />
          </AccordionItem>
        ) : null}

        <AccordionItem
          id="numeri"
          titolo="Come va la casa"
          sotto={abita || capexDetraibile(p) > 0 ? "Credito d'imposta, rendimento, leva" : "Rendimento e leva"}
        >
          <div className="flex flex-col divide-y divide-border">
            {abita || capexDetraibile(p) > 0 ? (
              <NumeroCasa
                voce="creditoImposta"
                sotto={`${money(recupero730Anno(p, casa, fisse), hidden, 0)} l'anno col 730`}
                pct={
                  <PercentualeVoto
                    pagella={{
                      ...pagellaCredito(creditoAttivo ? own.recupero / own.totale : 0, creditoAttivo),
                      dettaglio: (
                        <p className="text-muted">
                          Ti torna {money(own.recupero, hidden)} al mese su {money(own.totale, hidden)} di costo della
                          casa. Bonus lavori: {plurale(bonusQuoteRimanenti(p), "quota", "quote")} su {p.bonusQuoteTotali} ancora da prendere.
                        </p>
                      ),
                    }}
                  />
                }
              />
            ) : null}
            <NumeroCasa
              voce="rendimento"
              label={casa.uso === "abito" ? "Rendimento, se la affittassi" : undefined}
              sotto={
                casa.affittoEq > 0 && casa.prezzoAcquisto > 0
                  ? `${money(casa.affittoEq * 12, hidden, 0)} l'anno su ${money(pieno, hidden, 0)} spesi`
                  : casa.affittoEq > 0
                    ? "Serve il prezzo pagato"
                    : "Serve l'affitto al mese"
              }
              pct={
                <PercentualeVoto
                  pagella={pagellaRendimento(yieldOnCost(p), casa.affittoEq > 0 && casa.prezzoAcquisto > 0)}
                />
              }
            />
            {affitta ? (
              <NumeroCasa
                voce="rendimentoNetto"
                sotto="Tolte le spese che restano a te"
                pct={
                  <PercentualeVoto
                    pagella={pagellaRendimentoNetto(yieldNetto(p, casa, fisse), casa.affittoEq > 0 && v > 0)}
                  />
                }
              />
            ) : null}
            <NumeroCasa
              voce="leva"
              sotto={
                !(casa.capitaleMutuo > 0 && leva.tan > 0)
                  ? "Serve un mutuo con il suo tasso"
                  : casa.rivalutazioneScelta === false
                    ? "Scrivi di quanto pensi che salga la casa"
                    : `Casa ${pct(p.rivalutazionePct)} l'anno, mutuo ${pct(leva.tan, 2)}`
              }
              pct={
                <PercentualeVoto
                  pagella={pagellaLeva(leva.spread, casa.capitaleMutuo > 0 && leva.tan > 0 && casa.rivalutazioneScelta !== false)}
                />
              }
            />
          </div>
          <details className="mt-3 rounded-2xl bg-paper p-3">
            <summary className="-m-3 block cursor-pointer p-3 text-sm font-medium">Modifica le ipotesi</summary>
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <Label htmlFor="casa-campo-1" className="mb-0">
                    {VOCI.rivalutazione.nome} % all'anno
                  </Label>
                  <Info voce="rivalutazione" />
                </div>
                <NumberField
                  id="casa-campo-1"
                  value={Math.round(casa.rivalutazionePct * 1000) / 10}
                  digits={1}
                  min={-50}
                  max={50}
                  emptyCommitsZero
                  onCommit={(n) => patch({ rivalutazionePct: n / 100, rivalutazioneScelta: true })}
                />
                <div className="mt-1.5">
                  <DatoMercato
                    misura="case"
                    valoreAttuale={casa.rivalutazionePct}
                    onUsa={(x) => patch({ rivalutazionePct: x, rivalutazioneScelta: true })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="casa-campo-3">Quote dei bonus lavori già prese (su {casa.bonusQuoteTotali || 10})</Label>
                <NumberField id="casa-campo-3"
                  value={casa.bonusQuoteGodute}
                  digits={0}
                  min={0}
                  max={casa.bonusQuoteTotali || 10}
                  emptyCommitsZero
                  onCommit={(n) => patch({ bonusQuoteGodute: Math.round(n) })}
                />
              </div>
            </div>
          </details>
        </AccordionItem>
      </AccordionGroup>
    </>
  );
}

function NumeroCasa({
  voce,
  label,
  sotto,
  pct: percentuale,
}: {
  voce: "creditoImposta" | "rendimento" | "rendimentoNetto" | "leva";
  label?: string;
  sotto: string;
  pct: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <Etichetta voce={voce} label={label} className="text-[15px]" />
        <p className="mt-0.5 text-xs text-muted">{sotto}</p>
      </div>
      {percentuale}
    </div>
  );
}

function DatiCasa({ casa, patch }: { casa: Immobile; patch: (x: Partial<Immobile>) => void }) {
  const { removeImmobile, fisse } = useQuadra();
  const collegate = fisse.filter((f) => f.immobileId === casa.id);
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div>
        <Label htmlFor="c-nome">Nome</Label>
        <Input id="c-nome" value={casa.nome} onChange={(e) => patch({ nome: e.target.value })} />
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div>
          <Label htmlFor="c-citta">Città</Label>
          <Input id="c-citta" value={casa.citta ?? ""} onChange={(e) => patch({ citta: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="c-mq">Metri quadri</Label>
          <NumberField id="c-mq" value={casa.mq} digits={0} min={0} emptyCommitsZero onCommit={(n) => patch({ mq: n })} />
        </div>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-muted">Come la usi</p>
        <Segmenti label="Come la usi" valore={casa.uso ?? "abito"} onChange={(u) => patch({ uso: u })} opzioni={USI_IMMOBILE} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="c-zona">Prezzo al m² in zona €</Label>
          <NumberField
            id="c-zona"
            value={casa.eurMqZona ?? 0}
            digits={0}
            min={0}
            emptyCommitsZero
            onCommit={(n) => patch({ eurMqZona: n })}
          />
        </div>
        <div>
          <Label htmlFor="c-val">{VOCI.valoreCasa.nome} oggi €</Label>
          <NumberField
            id="c-val"
            value={casa.valoreCasa}
            digits={0}
            min={0}
            emptyCommitsZero
            onCommit={(n) => patch({ valoreCasa: n })}
          />
        </div>
      </div>
      <p className="text-xs text-muted">
        Se sai quanto vale, scrivilo: vince sulla stima. Altrimenti metri quadri × prezzo al m² della zona (lo trovi
        sui siti di annunci).
      </p>
      <Button
        variant="dangerSoft"
        className="mt-2"
        onClick={() => {
          const nome = casa.nome || "questa casa";
          if (!window.confirm(`Eliminare «${nome}»? Non si torna indietro.`)) return;
          const conSpese =
            collegate.length > 0 &&
            window.confirm(
              `Togliere anche ${collegate.length === 1 ? "la spesa legata" : `le ${collegate.length} spese legate`} a «${nome}» (${collegate.map((f) => f.nome).join(", ")})? Annulla per tenerle nelle spese fisse.`,
            );
          removeImmobile(casa.id, { conSpese });
        }}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Elimina la casa
      </Button>
    </div>
  );
}

function Acquisto({
  casa,
  patch,
  hidden,
}: {
  casa: Immobile;
  patch: (x: Partial<Immobile>) => void;
  hidden: boolean;
}) {
  const spese = casa.speseAcquisto ?? [];
  const [modifica, setModifica] = useState<SpesaAcquisto | "nuova-atto" | "nuova-lavori" | null>(null);
  const p = withImmobile(useQuadra.getState().patrimonio, casa);
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div>
          <Label htmlFor="c-prezzo">Prezzo pagato €</Label>
          <NumberField
            id="c-prezzo"
            value={casa.prezzoAcquisto}
            digits={0}
            min={0}
            emptyCommitsZero
            onCommit={(n) => patch({ prezzoAcquisto: n })}
          />
        </div>
        <div>
          <Label htmlFor="c-anno">Anno</Label>
          <NumberField
            id="c-anno"
            value={casa.annoAcquisto}
            digits={0}
            min={1900}
            max={2100}
            emptyAsZero={false}
            onCommit={(n) => patch({ annoAcquisto: n })}
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Spese di atto e lavori</p>
        {spese.length ? (
          <ul className="divide-y divide-border">
            {spese.map((s) => (
              <li key={s.id}>
                <Riga
                  titolo={s.nome || "Senza nome"}
                  sotto={s.tipo === "atto" ? "Atto" : s.detraibile ? "Lavori, con bonus" : "Lavori"}
                  importo={money(s.importo, hidden, 0)}
                  onClick={() => setModifica(s)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">Nessuna. Aggiungi notaio, imposte, agenzia, lavori.</p>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="soft" size="sm" onClick={() => setModifica("nuova-atto")}>
            <Plus className="size-4" aria-hidden="true" />
            Spesa di atto
          </Button>
          <Button variant="soft" size="sm" onClick={() => setModifica("nuova-lavori")}>
            <Plus className="size-4" aria-hidden="true" />
            Lavori
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Totale speso {money(costoPieno(p), hidden, 0)} · anticipo del 20 % {money(anticipo(p), hidden, 0)}
        </p>
      </div>
      {modifica ? (
        <SpesaAcquistoSheet
          iniziale={typeof modifica === "string" ? null : modifica}
          tipo={modifica === "nuova-lavori" ? "lavori" : typeof modifica === "string" ? "atto" : modifica.tipo}
          onClose={() => setModifica(null)}
          onSave={(s) => {
            const esiste = spese.some((x) => x.id === s.id);
            patch({ speseAcquisto: esiste ? spese.map((x) => (x.id === s.id ? s : x)) : [...spese, s] });
            setModifica(null);
          }}
          onDelete={(id) => {
            patch({ speseAcquisto: spese.filter((x) => x.id !== id) });
            setModifica(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SpesaAcquistoSheet({
  iniziale,
  tipo,
  onClose,
  onSave,
  onDelete,
}: {
  iniziale: SpesaAcquisto | null;
  tipo: SpesaAcquisto["tipo"];
  onClose: () => void;
  onSave: (s: SpesaAcquisto) => void;
  onDelete: (id: string) => void;
}) {
  const [nome, setNome] = useState(iniziale?.nome ?? (tipo === "lavori" ? "Lavori" : ""));
  const [importo, setImporto] = useState(iniziale ? String(iniziale.importo).replace(".", ",") : "");
  const [detraibile, setDetraibile] = useState(iniziale?.detraibile ?? false);
  const [err, setErr] = useState("");
  const t = iniziale?.tipo ?? tipo;
  function salva() {
    const n = parseNumberDraft(importo);
    if (!nome.trim()) return setErr("Dai un nome alla spesa.");
    if (n === null || n < 0) return setErr("Scrivi l'importo, per esempio 2.500.");
    onSave({
      id: iniziale?.id ?? nuovoId(),
      nome: nome.trim(),
      importo: Math.round(n * 100) / 100,
      tipo: t,
      detraibile: t === "lavori" && detraibile,
    });
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={iniziale ? iniziale.nome || "Spesa" : t === "lavori" ? "Nuovi lavori" : "Nuova spesa di atto"}
      footer={
        <div className="flex gap-2">
          {iniziale ? (
            <Button
              variant="dangerSoft"
              aria-label="Elimina"
              onClick={() => {
                if (window.confirm(`Eliminare «${iniziale.nome || "questa spesa"}»?`)) onDelete(iniziale.id);
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          <Button variant="primary" className="flex-1" onClick={salva}>
            Salva
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="sa-nome">Nome</Label>
          <Input
            id="sa-nome"
            value={nome}
            placeholder={t === "lavori" ? "Es. Infissi" : "Es. Notaio"}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sa-imp">Importo €</Label>
          <Input id="sa-imp" inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} />
        </div>
        {t === "lavori" ? (
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              checked={detraibile}
              onChange={(e) => setDetraibile(e.target.checked)}
              className="size-5 accent-[var(--color-pine)]"
            />
            Ha un bonus fiscale (il 50 % torna col 730 in 10 anni)
          </label>
        ) : null}
        {err ? (
          <p className="text-sm text-brick" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function SpeseCasa({ casa, hidden }: { casa: Immobile; hidden: boolean }) {
  const { fisse } = useQuadra();
  const ids = new Set(speseCasa(casa, fisse).map((r) => r.id));
  const righe = fisse.filter((f) => ids.has(f.id));
  const [modulo, setModulo] = useState<{ fissa: Fissa | null; voce?: VoceCasa } | null>(null);
  const presenti = new Set(righe.map((f) => f.voce));
  return (
    <div className="pt-1">
      {righe.length ? (
        <ul className="divide-y divide-border">
          {righe.map((f) => (
            <li key={f.id}>
              <Riga
                titolo={f.nome}
                sotto={`${VOCI_CASA.find((v) => v.id === f.voce)?.label ?? "Altro"}${
                  (f.frequenza ?? "mensile") !== "mensile" ? ` · ${money(f.importo, hidden)} ogni volta` : ""
                }`}
                importo={`${money(competenzaMese(f), hidden)}`}
                onClick={() => setModulo({ fissa: f })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">Nessuna spesa legata a questa casa.</p>
      )}
      <p className="mt-3 text-xs text-muted">Aggiungi</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {VOCI_CASA.filter((v) => v.id === "altro" || !presenti.has(v.id)).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setModulo({ fissa: null, voce: v.id })}
            className="inline-flex min-h-11 items-center gap-1 rounded-full bg-paper-2 px-3 text-sm"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {v.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Sono anche nelle spese fisse, categoria per categoria.</p>
      {modulo ? (
        <ModuloFissa
          key={modulo.fissa?.id ?? `nuova-${modulo.voce ?? ""}`}
          fissa={modulo.fissa}
          preset={
            modulo.voce
              ? {
                  immobileId: casa.id,
                  voce: modulo.voce,
                  categoria: "casa",
                  nome: modulo.voce === "altro" ? "" : VOCI_CASA.find((v) => v.id === modulo.voce)?.label,
                }
              : undefined
          }
          onClose={() => setModulo(null)}
        />
      ) : null}
    </div>
  );
}

function Mutuo({ casa, mutuo, hidden }: { casa: Immobile; mutuo: Fissa | undefined; hidden: boolean }) {
  const { updateImmobile, updateFissa, addFissa, removeFissa } = useQuadra();
  const patch = (x: Partial<Immobile>) => updateImmobile(casa.id, x);
  const [attivo, setAttivo] = useState(casa.capitaleMutuo > 0 || !!mutuo);
  const piano = hasPiano(mutuo);
  const rata = mutuo ? rataDi(mutuo, todayIso()) : undefined;

  if (!attivo) {
    return (
      <div className="pt-2">
        <p className="text-sm text-muted">Nessun mutuo su questa casa.</p>
        <Button variant="soft" size="sm" className="mt-2" onClick={() => setAttivo(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Ho un mutuo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="m-deb">Debito residuo €</Label>
          {piano ? (
            <Input id="m-deb" readOnly value={(rata?.k ?? casa.capitaleMutuo).toFixed(2).replace(".", ",")} className="text-muted" />
          ) : (
            <NumberField
              id="m-deb"
              value={casa.capitaleMutuo}
              digits={2}
              min={0}
              emptyCommitsZero
              onCommit={(n) => patch({ capitaleMutuo: n })}
            />
          )}
        </div>
        <div>
          <Label htmlFor="m-tan" className="flex items-center gap-1.5">
            {VOCI.tan.nome} % <Info voce="tan" />
          </Label>
          <NumberField
            id="m-tan"
            value={Math.round((casa.mutuoTan ?? 0) * 10000) / 100}
            digits={2}
            min={0}
            max={30}
            emptyCommitsZero
            onCommit={(n) => patch({ mutuoTan: n / 100 })}
          />
        </div>
        <div>
          <Label htmlFor="m-fine">Ultima rata</Label>
          <Input
            id="m-fine"
            type="month"
            value={casa.mutuoFine ?? ""}
            onChange={(e) => patch({ mutuoFine: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="m-rata">{mutuo && (mutuo.frequenza ?? "mensile") !== "mensile" ? "Rata, ogni addebito €" : "Rata al mese €"}</Label>
          {mutuo && !piano ? (
            <NumberField
              id="m-rata"
              value={mutuo.importo}
              digits={2}
              min={0}
              onCommit={(n) => updateFissa(mutuo.id, { importo: n })}
            />
          ) : mutuo && piano ? (
            <Input id="m-rata" readOnly value={(rata?.r ?? mutuo.importo).toFixed(2).replace(".", ",")} className="text-muted" />
          ) : (
            <NumberField
              id="m-rata"
              value={0}
              digits={2}
              min={0}
              emptyAsZero={false}
              onCommit={(n) => {
                if (!(n > 0)) return;
                const fid = addFissa({
                  nome: `Mutuo ${casa.nome}`,
                  importo: n,
                  giorno: 1,
                  mese: 1,
                  frequenza: "mensile",
                  categoria: "debito",
                  note: "",
                  immobileId: casa.id,
                  voce: "mutuo",
                });
                patch({ fissaMutuoId: fid });
              }}
            />
          )}
        </div>
      </div>
      {piano && rata ? (
        <div className="rounded-2xl bg-paper p-3 text-sm tabular-nums">
          <p className="font-medium">Dal piano della banca, questo mese</p>
          <p className="mt-1 text-muted">
            Interessi {money(rata.i, hidden)} (costo) · capitale {money(rata.c, hidden)} (abbassa il debito). Dopo la
            rata devi ancora {money(rata.k, hidden, 0)}.
          </p>
        </div>
      ) : !mutuo ? (
        <p className="text-xs text-muted">Scrivi la rata: va nelle spese fisse, legata a questa casa.</p>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (!window.confirm("Segnare che questa casa non ha mutuo?")) return;
          if (mutuo) {
            const togli = window.confirm(
              `Togliere anche la rata «${mutuo.nome}» dalle spese fisse?${piano ? " Si perde anche il piano della banca." : ""} Annulla per tenerla.`,
            );
            if (togli) removeFissa(mutuo.id);
            else updateFissa(mutuo.id, { immobileId: undefined, voce: undefined });
          }
          patch({ capitaleMutuo: 0, mutuoTan: 0, mutuoFine: "", fissaMutuoId: "" });
          setAttivo(false);
        }}
      >
        Nessun mutuo
      </Button>
    </div>
  );
}

function Confronto({
  casa,
  hidden,
  rataMese,
  patch,
}: {
  casa: Immobile;
  hidden: boolean;
  rataMese: number;
  patch: (x: Partial<Immobile>) => void;
}) {
  const { patrimonio, fisse } = useQuadra();
  const p = withImmobile(patrimonio, casa);
  const own = costoPossessoMese(p, casa, fisse);
  const rent = costoAffittoMese(p, casa, fisse);
  const righe = speseCasa(casa, fisse);
  const imuAnno = righe.filter((r) => r.voce === "imu").reduce((s, r) => s + r.mese * 12, 0);
  const tua = Math.max(0, equityCasa(p));
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div>
        <Label htmlFor="c-aff">Affitto di una casa così, in zona (€ al mese)</Label>
        <NumberField
          id="c-aff"
          value={casa.affittoEq}
          digits={0}
          min={0}
          emptyCommitsZero
          onCommit={(n) => patch({ affittoEq: n })}
        />
      </div>
      <ConfrontoCasa
        esceProprietario={rataMese + own.spese}
        esceAffitto={casa.affittoEq > 0 ? rent.totale : 0}
        parteTua={tua}
        imuAnno={imuAnno}
        recupero730Anno={own.recupero * 12}
        costoVeroMese={own.netto}
        affittoMese={casa.affittoEq > 0 ? rent.totale : 0}
        hidden={hidden}
      />
      <details className="rounded-2xl bg-paper p-3">
        <summary className="-m-3 block cursor-pointer p-3 text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            {VOCI.costoCasa.nome}: {money(own.netto, hidden, 0)} al mese
          </span>
        </summary>
        <dl className="mt-2 flex flex-col gap-1.5 text-sm tabular-nums">
          <RigaDl k="Interessi del mutuo" v={money(own.interessi, hidden)} />
          <RigaDl k="Spese della casa" v={money(own.spese, hidden)} />
          <RigaDl k={`${VOCI.manutenzione.nome} (${pct(casa.manutenzionePct)} del valore)`} v={money(own.manutenzione, hidden)} />
          <RigaDl k="Ti torna col 730" v={`−${money(own.recupero, hidden)}`} />
        </dl>
        <div className="mt-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Label htmlFor="casa-campo-2" className="mb-0">
              {VOCI.manutenzione.nome} % del valore all'anno
            </Label>
            <Info voce="manutenzione" />
          </div>
          <NumberField
            id="casa-campo-2"
            value={Math.round(casa.manutenzionePct * 1000) / 10}
            digits={1}
            min={0}
            max={10}
            emptyCommitsZero
            onCommit={(n) => patch({ manutenzionePct: n / 100 })}
          />
        </div>
      </details>
    </div>
  );
}


function RigaDl({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
