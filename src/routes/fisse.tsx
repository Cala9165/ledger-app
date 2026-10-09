import { createFileRoute } from "@tanstack/react-router";
import { FolderPlus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Info } from "@/components/info";
import { ModuloFissa, quandoEsce } from "@/components/modulo-fissa";
import { AccordionGroup, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, Cifra, Riga, Vuoto } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { fmtIt, todayIso } from "@/lib/banca";
import { VOCI } from "@/lib/nomi";
import { fissaConPiano, hasPiano, totaleFisseAl } from "@/lib/piano";
import {
  CATEGORIE_FISSE_BUILTIN,
  categorieFisse,
  competenzaMese,
  fisseQuelGiorno,
  type Fissa,
} from "@/lib/quadra";
import { useQuadra } from "@/lib/store";
import { money, plurale } from "@/lib/utils";

export const Route = createFileRoute("/fisse")({ component: FissePage });

function FissePage() {
  const { fisse, fisseCategorie, immobili, removeCategoriaFissa, nascostoSaldo: hidden } = useQuadra();
  const cats = useMemo(() => categorieFisse(fisseCategorie), [fisseCategorie]);
  const oggi = todayIso();
  const isoMese = `${oggi.slice(0, 7)}-01`;
  const F = totaleFisseAl(fisse, isoMese);
  const [modulo, setModulo] = useState<{ fissa: Fissa | null; categoria?: string } | null>(null);
  const [nuovaCat, setNuovaCat] = useState(false);
  const nomeCasa = (id?: string) => immobili.find((i) => i.id === id)?.nome;

  const gruppi = cats.map((c) => {
    const righe = fisse
      .filter((f) => f.categoria === c.id)
      .map((f) => ({ f, mese: competenzaMese(fissaConPiano(f, isoMese)) }))
      .sort((a, b) => b.mese - a.mese);
    return { cat: c, righe, tot: righe.reduce((s, r) => s + r.mese, 0) };
  });
  // Spese con una categoria che non esiste più: non spariscono, stanno in fondo.
  const note = new Set(cats.map((c) => c.id));
  const orfane = fisse.filter((f) => !note.has(f.categoria));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-1.5">
          <h1 className="text-sm font-normal text-muted">{VOCI.speseFisse.nome} · al mese</h1>
          <Info voce="speseFisse" />
        </div>
        <Cifra size="2xl" className="mt-1">
          {money(F, hidden)}
        </Cifra>
        <p className="mt-1 text-sm text-muted">
          {fisse.length === 1 ? "1 spesa" : `${fisse.length} spese`}. Le annuali contano per un dodicesimo.
        </p>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Button variant="primary" onClick={() => setModulo({ fissa: null })}>
            <Plus className="size-4" aria-hidden="true" />
            Aggiungi spesa
          </Button>
          <Button variant="soft" onClick={() => setNuovaCat(true)} aria-label="Aggiungi categoria">
            <FolderPlus className="size-4" aria-hidden="true" />
            Categoria
          </Button>
        </div>
      </Card>

      {fisse.length === 0 ? (
        <Vuoto>
          Nessuna spesa fissa. Aggiungi mutuo o affitto, bollette, abbonamenti. Se non ne hai, va bene così.
        </Vuoto>
      ) : null}

      <AccordionGroup>
        {gruppi.map(({ cat, righe, tot }) => {
          const custom = !CATEGORIE_FISSE_BUILTIN.has(cat.id);
          if (righe.length === 0 && !custom) return null;
          return (
            <AccordionItem
              key={cat.id}
              id={cat.id}
              titolo={cat.label}
              sotto={righe.length === 0 ? "Vuota" : righe.length === 1 ? "1 spesa" : `${righe.length} spese`}
              destra={<span className="font-medium">{money(tot, hidden, 0)}</span>}
            >
              <ElencoFisse
                righe={righe}
                hidden={hidden}
                nomeCasa={nomeCasa}
                onApri={(f) => setModulo({ fissa: f })}
              />
              <div className="mt-2 flex gap-2">
                <Button
                  variant="soft"
                  size="sm"
                  className="flex-1"
                  onClick={() => setModulo({ fissa: null, categoria: cat.id })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Aggiungi in {cat.label}
                </Button>
                {custom ? (
                  <Button
                    variant="dangerSoft"
                    size="sm"
                    aria-label={`Elimina la categoria ${cat.label}`}
                    onClick={() => {
                      const msg = righe.length
                        ? `Eliminare «${cat.label}»? ${righe.length === 1 ? "La sua spesa passa" : `Le sue ${righe.length} spese passano`} in Altro.`
                        : `Eliminare «${cat.label}»?`;
                      if (window.confirm(msg)) removeCategoriaFissa(cat.id);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </AccordionItem>
          );
        })}
        {orfane.length > 0 ? (
          <AccordionItem id="__orfane" titolo="Senza categoria" sotto={plurale(orfane.length, "spesa", "spese")}>
            <ul className="divide-y divide-border">
              {orfane.map((f) => (
                <li key={f.id}>
                  <Riga
                    titolo={f.nome}
                    sotto={quandoEsce(f)}
                    importo={money(competenzaMese(fissaConPiano(f, isoMese)), hidden)}
                    onClick={() => setModulo({ fissa: f })}
                  />
                </li>
              ))}
            </ul>
          </AccordionItem>
        ) : null}
        {fisse.length > 0 ? <Calendario fisse={fisse} hidden={hidden} /> : null}
      </AccordionGroup>

      {modulo ? (
        <ModuloFissa
          key={modulo.fissa?.id ?? `nuova-${modulo.categoria ?? ""}`}
          fissa={modulo.fissa}
          preset={modulo.categoria ? { categoria: modulo.categoria } : undefined}
          onClose={() => setModulo(null)}
        />
      ) : null}
      <NuovaCategoria open={nuovaCat} onClose={() => setNuovaCat(false)} />
    </div>
  );
}

/** Oltre questa soglia una categoria aperta mostra «Mostra altre»: mai 30 righe insieme. */
const RIGHE_PER_CATEGORIA = 25;

function ElencoFisse({
  righe,
  hidden,
  nomeCasa,
  onApri,
}: {
  righe: { f: Fissa; mese: number }[];
  hidden: boolean;
  nomeCasa: (id?: string) => string | undefined;
  onApri: (f: Fissa) => void;
}) {
  const [tutte, setTutte] = useState(false);
  const visibili = tutte ? righe : righe.slice(0, RIGHE_PER_CATEGORIA);
  return (
    <>
      <ul className="divide-y divide-border">
        {visibili.map(({ f, mese }) => (
          <li key={f.id}>
            <Riga
              titolo={f.nome}
              sotto={[
                hasPiano(f) ? "Rata dal piano" : quandoEsce(f),
                (f.frequenza ?? "mensile") !== "mensile" ? `${money(f.importo, hidden)} ogni volta` : "",
                nomeCasa(f.immobileId),
              ]
                .filter(Boolean)
                .join(" · ")}
              importo={money(mese, hidden)}
              onClick={() => onApri(f)}
            />
          </li>
        ))}
      </ul>
      {righe.length > visibili.length ? (
        <Button variant="soft" size="sm" className="mt-2 w-full" onClick={() => setTutte(true)}>
          Mostra altre {righe.length - visibili.length}
        </Button>
      ) : null}
    </>
  );
}

/** Cosa esce in un giorno preciso: importo pieno, non la media al mese. */
function Calendario({ fisse, hidden }: { fisse: Fissa[]; hidden: boolean }) {
  const [data, setData] = useState(todayIso());
  const due = fisseQuelGiorno(fisse, data).map((f) => fissaConPiano(f, data));
  const tot = due.reduce((s, f) => s + f.importo, 0);
  return (
    <AccordionItem id="__calendario" titolo="Cosa esce in un giorno" sotto="Scegli una data">
      <Input
        type="date"
        aria-label="Giorno"
        value={data}
        onChange={(e) => {
          if (e.target.value) setData(e.target.value);
        }}
        className="mt-2"
      />
      <p className="mt-3 text-sm text-muted">Il {fmtIt(data)} escono</p>
      <p className="text-2xl font-semibold tabular-nums">{money(tot, hidden)}</p>
      {due.length ? (
        <ul className="mt-2 divide-y divide-border">
          {due.map((f) => (
            <li key={f.id}>
              <Riga titolo={f.nome} importo={money(f.importo, hidden)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">Niente in scadenza quel giorno.</p>
      )}
    </AccordionItem>
  );
}

function NuovaCategoria({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCategoriaFissa, fisseCategorie } = useQuadra();
  const [nome, setNome] = useState("");
  const [err, setErr] = useState("");
  const cats = categorieFisse(fisseCategorie);
  function salva() {
    const pulito = nome.trim();
    if (!pulito) return setErr("Scrivi un nome.");
    if (cats.some((c) => c.label.toLowerCase() === pulito.toLowerCase())) return setErr(`«${pulito}» c'è già.`);
    if (!addCategoriaFissa(pulito)) return setErr("Serve almeno una lettera o un numero.");
    setNome("");
    setErr("");
    onClose();
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nuova categoria"
      footer={
        <Button variant="primary" className="w-full" onClick={salva}>
          Aggiungi
        </Button>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          salva();
        }}
      >
        <Label htmlFor="cat-nome">Nome</Label>
        <Input
          id="cat-nome"
          value={nome}
          placeholder="Es. Figli, Auto, Studio"
          onChange={(e) => {
            setNome(e.target.value);
            if (err) setErr("");
          }}
        />
        <p className="mt-2 text-sm text-muted">Serve solo a raggruppare. Se la cancelli, le sue spese vanno in Altro.</p>
        {err ? (
          <p className="mt-2 text-sm text-brick" role="alert">
            {err}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
