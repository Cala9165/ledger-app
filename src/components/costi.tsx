import { Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Riga, Segmenti } from "@/components/ui/card";
import { Input, Label, parseNumberDraft } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { CADENZE, costoAnno, mesiNelPeriodo, sembraAncheInAffitto, type Cadenza, type Costo, type Utenza } from "@/lib/investi";
import { eur, money } from "@/lib/utils";
import { nuovoId } from "@/lib/id";

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export function descriviCosto(c: Costo): string {
  if (c.utenza) {
    const u = c.utenza;
    return `${u.tipo === "luce" ? "Luce" : "Gas"} dai consumi: ${u.consumoAnno} ${u.tipo === "luce" ? "kWh" : "Smc"} l'anno`;
  }
  if (c.cadenza === "una") return "Una volta, all'inizio";
  if (c.cadenza === "periodo")
    return `${eur(c.importo)} al mese da ${MESI[(c.dalMese ?? 1) - 1]} a ${MESI[(c.alMese ?? 12) - 1]}`;
  return c.cadenza === "mese" ? "Al mese" : "All'anno";
}

/** Lista aperta di costi: aggiungi una riga, toccala per cambiarla o toglierla. */
export function ElencoCosti({
  costi,
  onChange,
  hidden = false,
  suggerimenti = [],
  conAffitto = false,
}: {
  costi: Costo[];
  onChange: (c: Costo[]) => void;
  hidden?: boolean;
  suggerimenti?: string[];
  /** «Ci abito»: ogni costo dice se lo pagheresti anche in affitto. */
  conAffitto?: boolean;
}) {
  const [aperto, setAperto] = useState<Costo | "nuovo" | "utenza" | null>(null);
  const tot = costi.reduce((s, c) => s + costoAnno(c), 0);
  const unaTantum = costi.filter((c) => c.cadenza === "una" && !c.utenza).reduce((s, c) => s + c.importo, 0);
  return (
    <div>
      {costi.length ? (
        <ul className="divide-y divide-border">
          {costi.map((c) => (
            <li key={c.id}>
              <Riga
                titolo={c.nome || "Senza nome"}
                sotto={`${descriviCosto(c)}${conAffitto && c.ancheInAffitto ? " · anche in affitto" : ""}`}
                importo={
                  c.cadenza === "una" && !c.utenza ? money(c.importo, hidden, 0) : `${money(costoAnno(c), hidden, 0)}/anno`
                }
                onClick={() => setAperto(c)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nessun costo. Aggiungi solo quelli che hai davvero.</p>
      )}
      {costi.length ? (
        <p className="mt-1 text-xs text-muted">
          {`Ogni anno ${money(tot, hidden, 0)}${unaTantum ? ` · una volta ${money(unaTantum, hidden, 0)}` : ""}`}
        </p>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="soft" size="sm" onClick={() => setAperto("nuovo")}>
          <Plus className="size-4" aria-hidden="true" />
          Aggiungi costo
        </Button>
        <Button variant="soft" size="sm" onClick={() => setAperto("utenza")}>
          <Zap className="size-4" aria-hidden="true" />
          Luce o gas
        </Button>
      </div>
      {aperto ? (
        <SchedaCosto
          iniziale={typeof aperto === "string" ? null : aperto}
          key={typeof aperto === "string" ? aperto : aperto.id}
          utenza={aperto === "utenza"}
          suggerimenti={suggerimenti}
          conAffitto={conAffitto}
          onClose={() => setAperto(null)}
          onSave={(c) => {
            onChange(costi.some((x) => x.id === c.id) ? costi.map((x) => (x.id === c.id ? c : x)) : [...costi, c]);
            setAperto(null);
          }}
          onDelete={(id) => {
            onChange(costi.filter((x) => x.id !== id));
            setAperto(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SchedaCosto({
  iniziale,
  utenza: nuovaUtenza,
  suggerimenti,
  conAffitto,
  onClose,
  onSave,
  onDelete,
}: {
  iniziale: Costo | null;
  utenza: boolean;
  suggerimenti: string[];
  conAffitto: boolean;
  onClose: () => void;
  onSave: (c: Costo) => void;
  onDelete: (id: string) => void;
}) {
  const conUtenza = nuovaUtenza || !!iniziale?.utenza;
  const [nome, setNome] = useState(iniziale?.nome ?? (nuovaUtenza ? "Luce" : ""));
  const [importo, setImporto] = useState(iniziale && !iniziale.utenza ? String(iniziale.importo).replace(".", ",") : "");
  const [cadenza, setCadenza] = useState<Cadenza>(iniziale?.cadenza ?? "mese");
  const [dal, setDal] = useState(iniziale?.dalMese ?? 10);
  const [al, setAl] = useState(iniziale?.alMese ?? 4);
  const [modoUtenza, setModoUtenza] = useState<"consumi" | "bolletta">(
    iniziale && !iniziale.utenza ? "bolletta" : "consumi",
  );
  const u0: Utenza = iniziale?.utenza ?? { tipo: "luce", consumoAnno: 0, prezzoUnita: 0, quotaFissaMese: 0, oneriAnno: 0 };
  const [tipo, setTipo] = useState<Utenza["tipo"]>(u0.tipo);
  const [consumo, setConsumo] = useState(u0.consumoAnno ? String(u0.consumoAnno) : "");
  const [prezzoU, setPrezzoU] = useState(u0.prezzoUnita ? String(u0.prezzoUnita).replace(".", ",") : "");
  const [quota, setQuota] = useState(u0.quotaFissaMese ? String(u0.quotaFissaMese).replace(".", ",") : "");
  const [oneri, setOneri] = useState(u0.oneriAnno ? String(u0.oneriAnno).replace(".", ",") : "");
  const [err, setErr] = useState("");
  // null = non ancora toccato: si propone in base al nome (bollette, rifiuti, internet).
  const [ancheInAffitto, setAncheInAffitto] = useState<boolean | null>(iniziale?.ancheInAffitto ?? null);
  const inAffitto = ancheInAffitto ?? (conUtenza || sembraAncheInAffitto(nome));
  const n = (s: string) => {
    const v = parseNumberDraft(s);
    return v !== null && v >= 0 ? v : 0;
  };
  const unita = tipo === "luce" ? "kWh" : "Smc";

  function salva() {
    if (!nome.trim()) return setErr("Dai un nome al costo.");
    const id = iniziale?.id ?? nuovoId();
    if (conUtenza && modoUtenza === "consumi") {
      if (!(n(consumo) > 0) || !(n(prezzoU) > 0))
        return setErr(`Servono il consumo in ${unita} e il prezzo per ${unita}. Se non li sai, scegli «Metto il totale».`);
      onSave({
        id,
        nome: nome.trim(),
        importo: 0,
        cadenza: "anno",
        utenza: { tipo, consumoAnno: n(consumo), prezzoUnita: n(prezzoU), quotaFissaMese: n(quota), oneriAnno: n(oneri) },
        ...(conAffitto ? { ancheInAffitto: inAffitto } : {}),
      });
      return;
    }
    const v = parseNumberDraft(importo);
    if (v === null || v < 0) return setErr("Scrivi l'importo, per esempio 60.");
    onSave({
      id,
      nome: nome.trim(),
      importo: Math.round(v * 100) / 100,
      cadenza,
      ...(cadenza === "periodo" ? { dalMese: dal, alMese: al } : {}),
      ...(conAffitto && cadenza !== "una" ? { ancheInAffitto: inAffitto } : {}),
    });
  }

  const anteprima =
    conUtenza && modoUtenza === "consumi"
      ? n(consumo) * n(prezzoU) + n(quota) * 12 + n(oneri)
      : null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={iniziale ? iniziale.nome || "Costo" : conUtenza ? "Luce o gas" : "Nuovo costo"}
      footer={
        <div className="flex gap-2">
          {iniziale ? (
            <Button
              variant="dangerSoft"
              aria-label="Togli il costo"
              onClick={() => {
                if (window.confirm(`Togliere «${iniziale.nome || "questo costo"}»?`)) onDelete(iniziale.id);
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
        {conUtenza ? (
          <Segmenti
            label="Che utenza"
            valore={tipo}
            onChange={(t) => {
              setTipo(t);
              if (nome === "Luce" || nome === "Gas" || !nome) setNome(t === "luce" ? "Luce" : "Gas");
            }}
            opzioni={[
              { id: "luce", label: "Luce" },
              { id: "gas", label: "Gas" },
            ]}
          />
        ) : null}
        <div>
          <Label htmlFor="co-nome">Nome</Label>
          <Input id="co-nome" value={nome} placeholder="Es. Pulizie" onChange={(e) => setNome(e.target.value)} />
          {!conUtenza && suggerimenti.length && !iniziale ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggerimenti.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNome(s)}
                  className="min-h-11 rounded-full bg-paper-2 px-3 text-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {conUtenza ? (
          <Segmenti
            label="Come lo calcolo"
            valore={modoUtenza}
            onChange={setModoUtenza}
            opzioni={[
              { id: "consumi", label: "So i consumi" },
              { id: "bolletta", label: "Metto il totale" },
            ]}
          />
        ) : null}
        {conUtenza && modoUtenza === "consumi" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="u-cons">Consumo all'anno ({unita})</Label>
                <Input id="u-cons" inputMode="decimal" value={consumo} onChange={(e) => setConsumo(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="u-pr">€ per {unita}</Label>
                <Input id="u-pr" inputMode="decimal" placeholder="0,12" value={prezzoU} onChange={(e) => setPrezzoU(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="u-q">Quota fissa € al mese</Label>
                <Input id="u-q" inputMode="decimal" placeholder="Se c'è" value={quota} onChange={(e) => setQuota(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="u-o">Trasporto e oneri € all'anno</Label>
                <Input id="u-o" inputMode="decimal" placeholder="Se li sai" value={oneri} onChange={(e) => setOneri(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted">
              I consumi sono in bolletta, alla voce «consumo annuo». {anteprima ? `Fa ${eur(anteprima, 0)} l'anno.` : ""}
            </p>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="co-imp">{cadenza === "periodo" ? "€ al mese, nei mesi in cui c'è" : "Importo €"}</Label>
              <Input id="co-imp" inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="co-cad">Ogni quanto</Label>
              <select
                id="co-cad"
                value={cadenza}
                onChange={(e) => setCadenza(e.target.value as Cadenza)}
                className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
              >
                {CADENZE.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {cadenza === "periodo" ? (
              <div className="grid grid-cols-2 gap-3">
                <MeseSelect id="co-dal" label="Dal mese" value={dal} onChange={setDal} />
                <MeseSelect id="co-al" label="Al mese" value={al} onChange={setAl} />
                <p className="col-span-2 text-sm text-muted">
                  {mesiNelPeriodo(dal, al) === 1 ? "1 mese" : `${mesiNelPeriodo(dal, al)} mesi`} l'anno. Es. riscaldamento da ottobre ad aprile.
                </p>
              </div>
            ) : null}
            {cadenza === "una" ? (
              <p className="text-sm text-muted">Una volta sola: entra in quanto spendi all'inizio, non nei costi di ogni anno.</p>
            ) : null}
          </>
        )}
        {conAffitto && !(cadenza === "una" && !conUtenza) ? (
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              checked={inAffitto}
              onChange={(e) => setAncheInAffitto(e.target.checked)}
              className="size-5 accent-[var(--color-pine)]"
            />
            La pagheresti anche in affitto (bollette, rifiuti, internet)
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

function MeseSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const nomi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-12 w-full rounded-xl bg-paper px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
      >
        {nomi.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
