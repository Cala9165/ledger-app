#!/usr/bin/env node
/**
 * Ultimo passo prima di pubblicare: una copia pulita del repository, con un solo
 * commit e senza la storia (che contiene ancora i dati personali del proprietario).
 *
 *   node scripts/dividi.mjs --prova                 solo i controlli, non crea niente
 *   node scripts/dividi.mjs ../ledger-pubblico      crea la copia in quella cartella
 *
 * Non crea repository su GitHub e non fa push: quello si fa a mano, dopo aver guardato.
 * Le parole da cercare stanno in src/private/termini.txt, che git ignora.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const git = (args, cwd = process.cwd()) => execFileSync("git", args, { cwd, encoding: "utf8" });
const esci = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

const prova = process.argv.includes("--prova");
const destinazione = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!prova && !destinazione) esci("Dimmi dove creare la copia: node scripts/dividi.mjs ../ledger-pubblico (oppure --prova).");

// 1. Il lavoro deve essere tutto committato: la copia parte dall'ultimo commit.
const sporchi = git(["status", "--porcelain"]).trim();
if (sporchi && !prova) esci(`Ci sono modifiche non committate. Committa prima, poi rilancia.\n${sporchi}`);

// 2. Le parole personali.
const fileTermini = "src/private/termini.txt";
if (!existsSync(fileTermini)) esci(`Manca ${fileTermini}: senza l'elenco non posso controllare niente.`);
const termini = readFileSync(fileTermini, "utf8")
  .split(/\r?\n/)
  .map((r) => r.trim())
  .filter((r) => r && !r.startsWith("#"))
  .map((r) => r.toLowerCase());

// 3. Solo i file tracciati (quelli che finirebbero nella copia). In prova: quelli del working tree.
const file = git(["ls-files", ...(prova ? ["--cached", "--others", "--exclude-standard"] : [])])
  .split("\n")
  .filter(Boolean)
  .filter((f) => existsSync(f));
const privati = file.filter((f) => f.startsWith("src/private/") || /(^|\/)\.env/.test(f));
if (privati.length) esci(`Questi file non devono esserci:\n${privati.join("\n")}`);

const trovati = [];
for (const f of file) {
  let testo;
  try {
    testo = readFileSync(f, "utf8").toLowerCase();
  } catch {
    continue;
  }
  for (const t of termini) {
    const i = testo.indexOf(t);
    if (i >= 0) {
      const riga = testo.slice(0, i).split("\n").length;
      trovati.push(`${f}:${riga}  «${t}»`);
    }
  }
}
if (trovati.length) esci(`Parole personali ancora nei file:\n${trovati.join("\n")}`);
console.log(`✓ ${file.length} file controllati, nessuna delle ${termini.length} parole personali.`);
if (prova) {
  console.log("  (prova: non ho creato niente)");
  process.exit(0);
}

// 4. La copia: file dell'ultimo commit, repository nuovo, un solo commit.
const dest = path.resolve(destinazione);
if (existsSync(dest) && readdirSync(dest).length) esci(`${dest} esiste e non è vuota.`);
mkdirSync(dest, { recursive: true });
for (const f of git(["ls-files"]).split("\n").filter(Boolean)) {
  const a = path.join(dest, f);
  mkdirSync(path.dirname(a), { recursive: true });
  copyFileSync(f, a);
}
git(["init", "-b", "main"], dest);
git(["add", "-A"], dest);
const nome = process.env.LEDGER_AUTORE ?? "Ledger";
// Nessun indirizzo di ripiego: «nome@users.noreply.github.com» è l'indirizzo dell'utente
// GitHub che si chiama così, e il commit risulterebbe suo. Serve quello del proprio account.
const email = process.env.LEDGER_EMAIL;
if (!email || !/^\d+\+[^@\s]+@users\.noreply\.github\.com$/.test(email))
  esci(
    "Dimmi con che indirizzo firmare: LEDGER_EMAIL=ID+utente@users.noreply.github.com (lo trovi in GitHub → Settings → Emails).",
  );
git(["-c", `user.name=${nome}`, "-c", `user.email=${email}`, "commit", "-q", "-m", "Ledger"], dest);
console.log(`✓ Copia pulita in ${dest}, un solo commit firmato «${nome} <${email}>».`);
console.log(`
Prossimi passi, a mano:
  1. Guarda la copia (README, STATO-E-FUTURO.md: vuoi pubblicarlo?).
  2. Crea su GitHub un repository NUOVO (non riusare quello vecchio).
  3. cd ${dest}
     git remote add origin <indirizzo del repository nuovo>
     git push -u origin main
  4. Il repository vecchio resta privato: è l'archivio con la storia.`);
