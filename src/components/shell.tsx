import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  Eye,
  EyeOff,
  Home,
  Landmark,
  ListChecks,
  PiggyBank,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { AccountSheet } from "@/components/account";
import { Avvio } from "@/components/avvio";
import { Button } from "@/components/ui/button";
import {
  browserPersistKv,
  dismissPersistRecovery,
  downloadPersistBackup,
  getPersistRecovery,
  subscribePersistRecovery,
} from "@/lib/persist";
import { CHIAVE_ATTIVA, CHIAVE_AVVIO, profiloScelto, type Profilo } from "@/lib/profilo";
import { useQuadra, VERSIONE_SALVATAGGIO } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/fisse", label: "Spese fisse", icon: ListChecks },
  { to: "/banca", label: "Dal conto", icon: Landmark },
  { to: "/casa", label: "Casa", icon: Building2 },
  { to: "/investi", label: "Investi", icon: TrendingUp },
  { to: "/patrimonio", label: "Quanto hai", icon: PiggyBank },
] as const;

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

function PersistRecoveryBanner() {
  const recovery = useSyncExternalStore(subscribePersistRecovery, getPersistRecovery, () => null);
  if (!recovery) return null;
  const kv = browserPersistKv();
  return (
    <div className="mx-4 mb-3 rounded-2xl bg-brick-2 p-4 text-sm text-brick" role="alert">
      {recovery.motivo === "righe" ? (
        <p>
          {recovery.righe === 1 ? "Una riga" : `${recovery.righe ?? "Alcune"} righe`} del salvataggio non si leggevano
          {recovery.dove?.length ? ` (${recovery.dove.join(", ")})` : ""} e le ho lasciate fuori: il resto c'è.{" "}
          {recovery.backupKey === recovery.name
            ? "Il telefono è pieno e non riesco a tenerne una copia: scarica il file adesso, prima di cambiare qualcosa."
            : "Ho tenuto una copia dell'originale: scaricala se ti servono."}
        </p>
      ) : (
        <p>
          {recovery.motivo === "caricamento"
            ? "Non riesco a caricare una parte del salvataggio. Non ho toccato niente e non salvo finché non lo scarichi."
            : recovery.blocked
              ? "Il salvataggio è danneggiato e il telefono è pieno: i dati originali sono ancora lì, intatti."
              : "Il salvataggio è danneggiato. Non ho cancellato niente: ne ho messo una copia da parte."}{" "}
          Scarica il file prima di continuare: l'app è ripartita vuota.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="danger" onClick={() => downloadPersistBackup(kv)}>
          Scarica la copia
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => dismissPersistRecovery(kv)}>
          Chiudi
        </Button>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [profilo, setProfilo] = useState<Profilo | null>(() => profiloScelto());
  const pathname = useRouterState({
    select: (s) => normalizePath(s.location.pathname),
  });
  const nascostoSaldo = useQuadra((s) => s.nascostoSaldo);
  const toggleSaldo = useQuadra((s) => s.toggleSaldo);
  const [account, setAccount] = useState(false);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.storageArea && e.storageArea !== window.localStorage) return;
      // Un'altra scheda ha cambiato profilo: questa si ricarica invece di scrivere sui dati sbagliati.
      if (e.key === CHIAVE_AVVIO && e.newValue !== e.oldValue) window.location.reload();
      // Un'altra scheda ha salvato: questa rilegge, così la sua prossima modifica non
      // riscrive i dati di prima sopra quelli nuovi. Rileggere la stessa versione non
      // riscrive niente; una versione diversa non si rilegge mai (si riscriverebbe).
      if (e.key === CHIAVE_ATTIVA && e.newValue !== e.oldValue) {
        if (e.newValue === null) {
          window.location.reload();
          return;
        }
        let versione: unknown;
        try {
          versione = (JSON.parse(e.newValue) as { version?: unknown } | null)?.version;
        } catch {
          versione = undefined;
        }
        // L'altra scheda ha un'app più nuova: si ricarica per avere lo stesso codice.
        if (typeof versione === "number" && versione > VERSIONE_SALVATAGGIO) {
          window.location.reload();
          return;
        }
        if (versione === VERSIONE_SALVATAGGIO) void useQuadra.persist.rehydrate();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!profilo) return <Avvio onScelto={setProfilo} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-paper/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur-md">
        <Link to="/" className="text-[17px] font-semibold tracking-tight">
          Ledger
          {profilo === "vuota" ? (
            <span className="ml-2 rounded-full bg-amber-2 px-2 py-0.5 align-middle text-[11px] font-medium text-amber">
              app vuota
            </span>
          ) : null}
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSaldo}
            aria-pressed={nascostoSaldo}
            aria-label={nascostoSaldo ? "Mostra importi" : "Nascondi importi"}
            className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-paper-2"
          >
            {nascostoSaldo ? (
              <Eye className="size-5" aria-hidden="true" />
            ) : (
              <EyeOff className="size-5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setAccount(true)}
            aria-label="Account, copia di sicurezza e glossario"
            className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-border)]"
          >
            <UserRound className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>
      <PersistRecoveryBanner />
      <main className="flex-1 px-4 pt-2 pb-28">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
        aria-label="Principale"
      >
        <ul className="grid grid-cols-6">
          {NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 text-center text-[10.5px] leading-tight font-medium",
                    active ? "text-pine" : "text-muted",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <AccountSheet open={account} onClose={() => setAccount(false)} />
    </div>
  );
}
