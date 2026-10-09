import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

const RADICE = import.meta.dirname;
const norm = (p: string) => path.posix.normalize(p.replace(/\\/g, "/").replace(/\/{2,}/g, "/")).toLowerCase();
/** La cartella dei dati del proprietario, col suo percorso esatto. */
const CARTELLA_PRIVATA = `${norm(path.resolve(RADICE, "src/private"))}/`;
const PROFILO = `${CARTELLA_PRIVATA}profilo.json`;

/**
 * La cartella src/private (dati del proprietario, ignorata da git) non si serve mai così
 * com'è: nessun file lì dentro arriva al browser, in nessun modo di avvio e per nessuna
 * strada (indirizzo diretto, /@fs/, /@id/, alias «@», ?raw, ?inline, ?url…). L'unica cosa
 * che l'app importa è profilo.json come modulo, e vale null quando i dati non vanno
 * portati. Chi decide è l'host vero del server, compreso un --host scritto a mano.
 */
function cartellaPrivata(): Plugin {
  let includi = false;
  // L'host che ascolta solo su questo computer.
  const soloQui = (h: unknown) => h === undefined || h === false || h === "localhost" || h === "127.0.0.1" || h === "::1";
  const decidi = (command: string, mode: string, host: unknown) =>
    command === "build"
      ? loadEnv(mode, RADICE, "VITE_").VITE_PROFILO_PRIVATO === "1"
      : mode === "telefono-dati" || (mode !== "telefono" && soloQui(host));
  return {
    name: "ledger-cartella-privata",
    enforce: "pre",
    config(c, { command, mode }) {
      includi = decidi(command, mode, c.server?.host);
      return { define: { __PROFILO_PRIVATO__: JSON.stringify(includi) } };
    },
    configResolved(c) {
      // Rete di sicurezza: se alla fine il server ascolta sulla rete, i dati restano fuori.
      if (c.command === "serve" && c.mode !== "telefono-dati" && !soloQui(c.server.host)) includi = false;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const q = url.indexOf("?");
        let percorso = q < 0 ? url : url.slice(0, q);
        try {
          percorso = decodeURIComponent(percorso);
        } catch {
          /* percorso malformato: si controlla così com'è */
        }
        const p = norm(percorso);
        const assoluto = p.startsWith("/@fs/") ? p.slice(4).replace(/^\/(?=[a-z]:)/, "") : null;
        const privato = p.startsWith("/src/private/") || (assoluto !== null && `${assoluto}`.startsWith(CARTELLA_PRIVATA));
        if (!privato) return next();
        // Il modulo che l'app importa: il contenuto lo decide load(), qui sotto.
        const ricerca = q < 0 ? "" : url.slice(q);
        if (p === "/src/private/profilo.json" && /^\?import(&t=\d+)?$/.test(ricerca)) return next();
        res.statusCode = 403;
        res.end("Non disponibile");
      });
    },
    load(id) {
      const [file, query = ""] = id.split("?");
      const f = norm(file);
      if (!f.startsWith(CARTELLA_PRIVATA)) return;
      // Solo profilo.json, solo come modulo (senza ?raw, ?inline, ?url) e solo quando va portato.
      if (includi && f === PROFILO && (query === "" || /^t=\d+$/.test(query))) return;
      return f.endsWith(".json") ? "null" : "export default null";
    },
  };
}

export default defineConfig(({ mode }) => {
  // «npm run dev»: solo su questo computer, con i dati privati.
  // «npm run dev:telefono»: aperto alla rete di casa, senza dati privati (uso di tutti i giorni).
  // «npm run dev:telefono:dati»: aperto alla rete con i dati privati, da usare una volta sola
  // per portarli sul telefono; finché gira, chi è sulla stessa rete può chiedere quel modulo.
  // Un «vite --host» qualunque (anche --host=0.0.0.0) apre la rete senza dati. Una build li
  // include solo se chiesto apposta con VITE_PROFILO_PRIVATO=1.
  const rete = mode === "telefono" || mode === "telefono-dati";
  return {
    plugins: [
      cartellaPrivata(),
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: { "@": path.resolve(RADICE, "./src") },
    },
    server: {
      host: rete ? true : "localhost",
      port: 5173,
      // Porta fissa: su un'altra porta l'indirizzo cambia e i dati salvati sembrano spariti.
      strictPort: true,
    },
  };
});
