import { useBlocker } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmenti } from "@/components/ui/card";
import { Input, Label, parseNumberDraft } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import {
  IMMOBILE_VUOTO,
  USI_IMMOBILE,
  VOCI_CASA,
  type Frequenza,
  type SpesaAcquisto,
  type UsoImmobile,
  type VoceCasa,
} from "@/lib/quadra";
import { useQuadra } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Info } from "@/components/info";
import { VOCI } from "@/lib/nomi";
import { nuovoId } from "@/lib/id";

type RigaAtto = { id: string; nome: string; importo: string; tipo: SpesaAcquisto["tipo"]; detraibile: boolean };
type RigaSpesa = { id: string; voce: VoceCasa; nome: string; importo: string; frequenza: Frequenza };

const PASSI = ["La casa", "Acquisto", "Spese", "Mutuo"] as const;

const num = (s: string) => {
  const n = parseNumberDraft(s);
  return n !== null && Number.isFinite(n) ? n : null;
};

/** Rata alla francese, per proporla quando l'utente non la sa. */
function rataStimata(debito: number, tan: number, mesi: number): number {
  if (!(debito > 0) || !(mesi > 0)) return 0;
  if (!(tan > 0)) return debito / mesi;
  const i = tan / 12;
  const p = (1 + i) ** mesi;
  return (debito * i * p) / (p - 1);
}

function mesiFinoA(yyyymm: string): number {
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) return 0;
  const d = new Date();
  const [y, m] = yyyymm.split("-").map(Number);
  return Math.max(0, (y - d.getFullYear()) * 12 + (m - (d.getMonth() + 1)) + 1);
}

/**
 * Un immobile si inserisce tutto di fila, in quattro passi. Dopo, ogni pezzo
 * si modifica dalla sua voce nella scheda della casa.
 */
export function CasaWizard({ onClose, onCreata }: { onClose: () => void; onCreata: (id: string) => void }) {
  const { addImmobile, updateImmobile, addFissa } = useQuadra();
  const [passo, setPasso] = useState(0);
  const [err, setErr] = useState("");
  // 1
  const [nome, setNome] = useState("");
  const [citta, setCitta] = useState("");
  const [mq, setMq] = useState("");
  const [uso, setUso] = useState<UsoImmobile>("abito");
  // 2
  const [prezzo, setPrezzo] = useState("");
  const [anno, setAnno] = useState(String(new Date().getFullYear()));
  const [atti, setAtti] = useState<RigaAtto[]>([
    { id: "notaio", nome: "Notaio", importo: "", tipo: "atto", detraibile: false },
    { id: "imposte", nome: "Imposte di acquisto", importo: "", tipo: "atto", detraibile: false },
    { id: "agenzia", nome: "Agenzia", importo: "", tipo: "atto", detraibile: false },
  ]);
  // 3
  const [spese, setSpese] = useState<RigaSpesa[]>(() =>
    (["condominio", "imu", "tari", "assicurazione", "luce", "gas"] as VoceCasa[]).map((v) => ({
      id: v,
      voce: v,
      nome: VOCI_CASA.find((x) => x.id === v)?.label ?? v,
      importo: "",
      frequenza: v === "imu" || v === "tari" || v === "assicurazione" ? "annuale" : "mensile",
    })),
  );
  // 4
  const [haMutuo, setHaMutuo] = useState<"si" | "no">("no");
  const [debito, setDebito] = useState("");
  const [rata, setRata] = useState("");
  const [tan, setTan] = useState("");
  const [fine, setFine] = useState("");

  function avanti() {
    setErr("");
    if (passo === 0 && !nome.trim()) {
      setErr("Dai un nome alla casa, per esempio «Casa mia» o «Bilocale al mare».");
      return;
    }
    if (passo < PASSI.length - 1) setPasso(passo + 1);
    else salva();
  }

  function salva() {
    const d = num(debito) ?? 0;
    const r = num(rata) ?? 0;
    const t = (num(tan) ?? 0) / 100;
    if (haMutuo === "si" && !(d > 0)) {
      setErr("Scrivi il debito residuo, o scegli «Nessun mutuo».");
      return;
    }
    if (haMutuo === "si" && !(r > 0) && !(rataStimata(d, t, mesiFinoA(fine)) > 0)) {
      setErr("Scrivi la rata al mese, oppure il tasso e l'ultima rata così la calcolo io.");
      return;
    }
    const speseAcquisto: SpesaAcquisto[] = atti
      .map((a) => ({ ...a, v: num(a.importo) ?? 0 }))
      .filter((a) => a.nome.trim() && a.v > 0)
      .map((a) => ({
        id: nuovoId(),
        nome: a.nome.trim(),
        importo: a.v,
        tipo: a.tipo,
        detraibile: a.tipo === "lavori" && a.detraibile,
      }));
    const id = addImmobile({
      ...IMMOBILE_VUOTO,
      nome: nome.trim(),
      citta: citta.trim(),
      mq: num(mq) ?? 0,
      uso,
      prezzoAcquisto: num(prezzo) ?? 0,
      annoAcquisto: Number(anno) || new Date().getFullYear(),
      speseAcquisto,
      capitaleMutuo: haMutuo === "si" ? d : 0,
      mutuoTan: haMutuo === "si" ? t : 0,
      mutuoFine: haMutuo === "si" ? fine : "",
      // La rivalutazione la sceglie l'utente dalla scheda: finché non la scrive, niente voto sulla leva.
      rivalutazionePct: 0,
      rivalutazioneScelta: false,
      manutenzionePct: IMMOBILE_VUOTO.manutenzionePct,
    });
    for (const s of spese) {
      const v = num(s.importo);
      if (!s.nome.trim() || v === null || !(v > 0)) continue;
      addFissa({
        nome: s.nome.trim(),
        importo: Math.round(v * 100) / 100,
        giorno: 1,
        mese: 1,
        frequenza: s.frequenza,
        categoria: "casa",
        note: "",
        immobileId: id,
        voce: s.voce,
      });
    }
    if (haMutuo === "si") {
      const rataFinale = r > 0 ? r : Math.round(rataStimata(d, t, mesiFinoA(fine)) * 100) / 100;
      if (rataFinale > 0) {
        const fid = addFissa({
          nome: `Mutuo ${nome.trim()}`,
          importo: rataFinale,
          giorno: 1,
          mese: 1,
          frequenza: "mensile",
          categoria: "debito",
          note: "",
          immobileId: id,
          voce: "mutuo",
        });
        updateImmobile(id, { fissaMutuoId: fid });
      }
    }
    onCreata(id);
  }

  const stima = rataStimata(num(debito) ?? 0, (num(tan) ?? 0) / 100, mesiFinoA(fine));

  // Una casa scritta a metà non si butta via con un tocco sul fondo o col tasto indietro.
  const sporco =
    !!(nome.trim() || citta.trim() || mq.trim() || prezzo.trim()) ||
    atti.some((a) => a.importo.trim()) ||
    spese.some((s) => s.importo.trim()) ||
    (haMutuo === "si" && !!(debito.trim() || rata.trim() || tan.trim()));
  const conferma = () => !sporco || window.confirm("Lasciare la casa a metà? Quello che hai scritto si perde.");
  useBlocker({ shouldBlockFn: () => !conferma(), enableBeforeUnload: () => sporco });

  return (
    <Sheet
      open
      onClose={onClose}
      primaDiChiudere={conferma}
      title={
        <span>
          Nuova casa
          <span className="mt-1 block text-sm font-normal text-muted">
            Passo {passo + 1} di {PASSI.length} · {PASSI[passo]}
          </span>
        </span>
      }
      footer={
        <div className="flex flex-col gap-2">
          {err ? (
            <p className="text-sm text-brick" role="alert">
              {err}
            </p>
          ) : null}
          <div className="flex gap-2">
            {passo > 0 ? (
              <Button variant="soft" onClick={() => setPasso(passo - 1)}>
                Indietro
              </Button>
            ) : null}
            <Button variant="primary" className="flex-1" onClick={avanti}>
              {passo < PASSI.length - 1 ? "Avanti" : "Salva la casa"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="mb-4 flex gap-1" aria-hidden="true">
        {PASSI.map((p, i) => (
          <span key={p} className={cn("h-1 flex-1 rounded-full", i <= passo ? "bg-pine" : "bg-paper-2")} />
        ))}
      </div>

      {passo === 0 ? (
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="w-nome">Nome</Label>
            <Input id="w-nome" value={nome} placeholder="Es. Casa mia" onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <Label htmlFor="w-citta">Città</Label>
              <Input id="w-citta" value={citta} placeholder="Es. Bologna" onChange={(e) => setCitta(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="w-mq">Metri quadri</Label>
              <Input id="w-mq" inputMode="numeric" value={mq} placeholder="60" onChange={(e) => setMq(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-muted">Come la usi</p>
            <Segmenti label="Come la usi" valore={uso} onChange={setUso} opzioni={USI_IMMOBILE} />
          </div>
        </div>
      ) : null}

      {passo === 1 ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <Label htmlFor="w-prezzo">Prezzo pagato €</Label>
              <Input id="w-prezzo" inputMode="decimal" value={prezzo} placeholder="150.000" onChange={(e) => setPrezzo(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="w-anno">Anno</Label>
              <Input id="w-anno" inputMode="numeric" value={anno} onChange={(e) => setAnno(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Spese di atto e lavori</p>
            <p className="text-xs text-muted">Lascia vuote quelle che non hai avuto. Rinomina come vuoi.</p>
            <ul className="mt-2 flex flex-col gap-2">
              {atti.map((a, idx) => (
                <li key={a.id} className="flex flex-col gap-2 rounded-2xl bg-paper p-3">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <Input
                      aria-label="Nome della spesa"
                      value={a.nome}
                      onChange={(e) => setAtti(atti.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)))}
                      className="bg-surface"
                    />
                    <button
                      type="button"
                      aria-label={`Togli ${a.nome}`}
                      onClick={() => setAtti(atti.filter((_, i) => i !== idx))}
                      className="flex size-11 items-center justify-center rounded-full text-muted"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <Input
                    aria-label={`Importo ${a.nome}`}
                    inputMode="decimal"
                    placeholder="Importo €"
                    value={a.importo}
                    onChange={(e) => setAtti(atti.map((x, i) => (i === idx ? { ...x, importo: e.target.value } : x)))}
                    className="bg-surface"
                  />
                  {a.tipo === "lavori" ? (
                    <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={a.detraibile}
                        onChange={(e) =>
                          setAtti(atti.map((x, i) => (i === idx ? { ...x, detraibile: e.target.checked } : x)))
                        }
                        className="size-5 accent-[var(--color-pine)]"
                      />
                      Ha un bonus fiscale (infissi, tetto, caldaia…)
                    </label>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="soft"
                size="sm"
                onClick={() =>
                  setAtti([...atti, { id: nuovoId(), nome: "", importo: "", tipo: "atto", detraibile: false }])
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                Spesa di atto
              </Button>
              <Button
                variant="soft"
                size="sm"
                onClick={() =>
                  setAtti([...atti, { id: nuovoId(), nome: "Lavori", importo: "", tipo: "lavori", detraibile: false }])
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                Lavori
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {passo === 2 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            Le spese che si ripetono, di questa casa. Lascia vuote quelle che non hai: vanno nelle spese fisse.
          </p>
          <ul className="flex flex-col gap-2">
            {spese.map((s, idx) => (
              <li key={s.id} className="flex flex-col gap-2 rounded-2xl bg-paper p-3">
                <Input
                  aria-label="Nome della spesa"
                  value={s.nome}
                  onChange={(e) => setSpese(spese.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)))}
                  className="bg-surface"
                />
                <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label={`Importo ${s.nome}`}
                  inputMode="decimal"
                  placeholder="Importo €"
                  value={s.importo}
                  onChange={(e) => setSpese(spese.map((x, i) => (i === idx ? { ...x, importo: e.target.value } : x)))}
                  className="bg-surface"
                />
                <select
                  aria-label={`Ogni quanto ${s.nome}`}
                  value={s.frequenza}
                  onChange={(e) =>
                    setSpese(spese.map((x, i) => (i === idx ? { ...x, frequenza: e.target.value as Frequenza } : x)))
                  }
                  className="h-12 w-full rounded-xl bg-surface px-3 text-[15px] shadow-[inset_0_0_0_1px_var(--color-border)]"
                >
                  <option value="mensile">al mese</option>
                  <option value="trimestrale">ogni 3 mesi</option>
                  <option value="semestrale">ogni 6 mesi</option>
                  <option value="annuale">all'anno</option>
                </select>
                </div>
              </li>
            ))}
          </ul>
          <Button
            variant="soft"
            size="sm"
            className="mt-1"
            onClick={() =>
              setSpese([...spese, { id: nuovoId(), voce: "altro", nome: "", importo: "", frequenza: "mensile" }])
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Altra spesa
          </Button>
        </div>
      ) : null}

      {passo === 3 ? (
        <div className="flex flex-col gap-4">
          <Segmenti
            label="Mutuo"
            valore={haMutuo}
            onChange={setHaMutuo}
            opzioni={[
              { id: "no", label: "Nessun mutuo" },
              { id: "si", label: "Ho un mutuo" },
            ]}
          />
          {haMutuo === "si" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="w-deb">Debito residuo €</Label>
                  <Input id="w-deb" inputMode="decimal" value={debito} placeholder="90.000" onChange={(e) => setDebito(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="w-tan" className="flex items-center gap-1.5">
                    {VOCI.tan.nome} % <Info voce="tan" />
                  </Label>
                  <Input id="w-tan" inputMode="decimal" value={tan} placeholder="3,2" onChange={(e) => setTan(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="w-fine">Ultima rata</Label>
                  <Input id="w-fine" type="month" value={fine} onChange={(e) => setFine(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="w-rata">Rata al mese €</Label>
                  <Input
                    id="w-rata"
                    inputMode="decimal"
                    value={rata}
                    placeholder={stima > 0 ? stima.toFixed(2).replace(".", ",") : "450"}
                    onChange={(e) => setRata(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted">
                {stima > 0 && !rata
                  ? `Se non scrivi la rata uso la stima: ${stima.toFixed(2).replace(".", ",")} € con questi dati.`
                  : "La rata va nelle spese fisse, legata a questa casa."}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Nessuna rata. Se un giorno fai un mutuo, lo aggiungi dalla scheda della casa.</p>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
