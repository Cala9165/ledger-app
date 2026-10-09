import { Link } from "@tanstack/react-router";
import { BookOpen, Download, RotateCcw, Smartphone, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Info } from "@/components/info";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { fermaScritture, riprendiScritture } from "@/lib/persist";
import {
  CHIAVE_AVVIO,
  ciSonoDati,
  CHIAVE_TELEFONO,
  nomeSalvataggio,
  PROFILO_ATTIVO,
} from "@/lib/profilo";
import { useQuadra } from "@/lib/store";
import { fmtIt, todayIso } from "@/lib/banca";

function leggi(chiave: string): string | null {
  try {
    return localStorage.getItem(chiave);
  } catch {
    return null;
  }
}

const PRIMA = () => `${nomeSalvataggio()}.prima-del-ripristino`;
const PRIMA_QUANDO = () => `${nomeSalvataggio()}.prima-del-ripristino.quando`;

function scaricaCopia(): boolean {
  const chiave = nomeSalvataggio();
  const raw = leggi(chiave) ?? JSON.stringify({ state: {}, version: 21 });
  try {
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-copia-${todayIso()}.json`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Una copia di sicurezza valida è un salvataggio di Ledger: { state: {...}, version }. */
export function copiaValida(raw: string): boolean {
  try {
    const x = JSON.parse(raw) as { state?: Record<string, unknown> };
    const s = x?.state;
    if (!s || typeof s !== "object" || Array.isArray(s)) return false;
    return ["fisse", "immobili", "cedolini", "patrimonio", "csvMovimenti"].some((k) => k in s);
  } catch {
    return false;
  }
}

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Il profilo di QUESTA scheda, non quello scelto magari in un'altra scheda.
  const profilo = PROFILO_ATTIVO;
  const reset = useQuadra((s) => s.reset);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function ripristina(raw: string) {
    setErr("");
    if (!copiaValida(raw)) {
      setErr("Questo file non è una copia di sicurezza di Ledger.");
      return;
    }
    if (!window.confirm("Ripristinare questa copia? I dati di adesso vengono sostituiti (ne tengo una copia sul telefono).")) {
      return;
    }
    const chiave = nomeSalvataggio();
    const prima = leggi(chiave);
    let copiaScritta = false;
    try {
      if (prima) {
        localStorage.setItem(PRIMA(), prima);
        localStorage.setItem(PRIMA_QUANDO(), todayIso());
        copiaScritta = true;
      }
      // Da qui l'app non salva più niente: una scrittura in coda cancellerebbe il ripristino.
      fermaScritture();
      localStorage.setItem(chiave, raw);
      window.location.reload();
    } catch {
      riprendiScritture();
      if (copiaScritta) {
        try {
          localStorage.removeItem(PRIMA());
          localStorage.removeItem(PRIMA_QUANDO());
        } catch {
          /* niente */
        }
      }
      setErr("Non riesco a scrivere sul telefono (spazio pieno?). Niente è stato cambiato.");
    }
  }

  function cambiaProfilo() {
    try {
      localStorage.setItem(CHIAVE_AVVIO, profilo === "vuota" ? "telefono" : "vuota");
      window.location.reload();
    } catch {
      setErr("Non riesco a cambiare: il telefono non salva.");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Account">
      <div className="flex flex-col gap-5">
        <section className="rounded-2xl bg-paper p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-surface">
              <Smartphone className="size-5 text-muted" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">Dati in uso</p>
              <p className="font-medium">
                {profilo === "vuota" ? "App vuota" : "I dati di questo telefono"}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Stanno solo su questo telefono, in questo browser. Nessun server, nessuna registrazione.
          </p>
          {(profilo === "vuota" || ciSonoDati(CHIAVE_TELEFONO)) && (
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={cambiaProfilo}>
              {profilo === "vuota" ? "Torna ai dati del telefono" : "Prova l'app vuota"}
            </Button>
          )}
          {profilo === "vuota" && (
            <p className="mt-2 text-xs text-muted">I dati di prima sono al sicuro: non li tocco.</p>
          )}
        </section>

        <section>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            Copia di sicurezza <Info voce="copiaSicurezza" />
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              variant="soft"
              onClick={() => {
                const ok = scaricaCopia();
                setMsg(ok ? "Copia scaricata. Tienila fuori dal telefono." : "");
                setErr(ok ? "" : "Non riesco a creare il file su questo browser.");
              }}
            >
              <Download className="size-4" aria-hidden="true" />
              Scarica
            </Button>
            <Button variant="soft" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              Ripristina
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const r = new FileReader();
              r.onload = () => ripristina(String(r.result ?? ""));
              r.readAsText(f);
            }}
          />
          {msg ? <p className="mt-2 text-sm text-pine">{msg}</p> : null}
          {err ? (
            <p className="mt-2 text-sm text-brick" role="alert">
              {err}
            </p>
          ) : null}
        </section>

        <Link
          to="/glossario"
          onClick={onClose}
          className="flex min-h-12 items-center gap-3 rounded-2xl bg-paper px-4 font-medium"
        >
          <BookOpen className="size-5 text-muted" aria-hidden="true" />
          Glossario
        </Link>

        <section className="border-t border-border pt-4">
          <Button
            variant="dangerSoft"
            className="w-full"
            onClick={() => {
              if (
                window.confirm(
                  "Azzerare tutti i dati di questo profilo? Non si torna indietro. Scarica prima una copia di sicurezza.",
                )
              ) {
                // «Tutti» vuol dire anche la copia tenuta per annullare un ripristino.
                try {
                  localStorage.removeItem(PRIMA());
                  localStorage.removeItem(PRIMA_QUANDO());
                } catch {
                  /* niente */
                }
                reset();
                onClose();
              }
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Azzera questi dati
          </Button>
          {leggi(PRIMA()) ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                const prima = leggi(PRIMA());
                if (!prima || !window.confirm("Rimettere i dati di prima dell'ultimo ripristino?")) return;
                try {
                  // Scritture congelate: nessun salvataggio in coda può più rimettere i dati di adesso.
                  fermaScritture();
                  localStorage.setItem(nomeSalvataggio(), prima);
                  // Si torna indietro una volta sola.
                  localStorage.removeItem(PRIMA());
                  localStorage.removeItem(PRIMA_QUANDO());
                  window.location.reload();
                } catch {
                  riprendiScritture();
                  setErr("Non riesco a scrivere sul telefono.");
                }
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Annulla il ripristino{leggi(PRIMA_QUANDO()) ? ` del ${fmtIt(leggi(PRIMA_QUANDO()) ?? "")}` : ""}
            </Button>
          ) : null}
        </section>
      </div>
    </Sheet>
  );
}
