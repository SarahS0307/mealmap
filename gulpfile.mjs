/**
 * Gulp + BrowserSync für MealMap.
 *
 * Next.js bringt mit Fast Refresh eigenes Hot Reloading mit. BrowserSync legt
 * sich als Proxy davor und ergänzt zwei Dinge, die Next nicht kann:
 *
 *   1. eine URL im lokalen Netz, mit der du die App direkt am Handy öffnest
 *   2. Geräte-Mirroring – Scrollen, Klicks und Formulareingaben laufen auf
 *      allen verbundenen Geräten synchron
 *
 * `ws: true` reicht den HMR-Websocket von Next durch, damit Fast Refresh
 * weiter funktioniert.
 *
 *   npm run dev    nur Next   -> http://localhost:3000
 *   npm run sync   mit Proxy  -> http://localhost:3001 (+ externe URL)
 */

import { spawn } from "node:child_process";
import net from "node:net";
import browserSyncModule from "browser-sync";
import gulp from "gulp";

const browserSync = browserSyncModule.create();

const NEXT_PORT = Number(process.env.NEXT_PORT ?? 3000);
const SYNC_PORT = Number(process.env.SYNC_PORT ?? 3001);

let nextProcess = null;

/** Pollt den Port, bis Next antwortet – maximal 60 Sekunden. */
function waitForPort(port, timeoutMs = 60_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host: "127.0.0.1" });

      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Next ist auf Port ${port} nicht gestartet.`));
          return;
        }
        setTimeout(attempt, 400);
      });
    };

    attempt();
  });
}

/** Startet `next dev` und wartet, bis der Server Verbindungen annimmt. */
function startNext() {
  nextProcess = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--port", String(NEXT_PORT)],
    {
      stdio: "inherit",
      // Signal an das Layout, das BrowserSync-Client-Skript einzubinden.
      env: { ...process.env, BROWSERSYNC: "1" },
    },
  );

  nextProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n[gulp] next dev wurde mit Code ${code} beendet.`);
    }
    browserSync.exit();
    process.exit(code ?? 0);
  });

  return waitForPort(NEXT_PORT);
}

/** Hängt BrowserSync als Proxy vor den laufenden Next-Server. */
function startBrowserSync() {
  return new Promise((resolve) => {
    browserSync.init(
      {
        proxy: `http://localhost:${NEXT_PORT}`,
        port: SYNC_PORT,
        ws: true, // HMR-Websocket von Next durchreichen
        open: false, // Browser nicht selbst aufreißen
        notify: false, // kein Overlay über der App
        // Next streamt sein HTML, die Auto-Injection von BrowserSync greift
        // dabei nicht zuverlässig. Das Skript bindet daher das Layout selbst
        // ein, sobald BROWSERSYNC gesetzt ist (siehe src/app/layout.tsx).
        snippet: false,
        ghostMode: { clicks: true, forms: true, scroll: true },
        ui: { port: SYNC_PORT + 1 },
      },
      resolve,
    );
  });
}

/**
 * Next kümmert sich selbst um Code-Reloads. BrowserSync bekommt nur noch mit,
 * wenn sich Dateien ändern, die Next nicht hot-reloaded – etwa Bilder oder
 * andere Dateien unter /public.
 */
function watchPublic() {
  browserSync.watch("public/**/*", (event) => {
    if (event === "change" || event === "add") {
      browserSync.reload();
    }
  });
}

function cleanup() {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", cleanup);

export async function sync() {
  await startNext();
  await startBrowserSync();
  watchPublic();
  console.log(
    `\n[gulp] BrowserSync läuft auf http://localhost:${SYNC_PORT}\n` +
      `[gulp] Die externe URL oben im Log öffnest du am Handy.\n`,
  );
}

/**
 * Beobachtet die Quelldateien und baut das Bündel bei jeder Änderung neu.
 *
 * Gedacht für die produktionsnahe Umgebung unter localhost:8888/MealMap/:
 * Dort liefert Apache fertige Dateien aus, die sich nicht selbst erneuern
 * können. Der Neubau läuft damit automatisch – die Seite im Browser musst du
 * danach einmal neu laden (Cmd+R).
 */
/**
 * Beobachtet die Quelldateien, baut das Bündel neu und lädt die Seite im
 * Browser automatisch nach.
 *
 * BrowserSync läuft dabei als reiner Meldedienst: Es liefert die Seite nicht
 * aus – das macht weiterhin Apache unter localhost:8888/MealMap/. Die Seite
 * lädt nur den BrowserSync-Client nach und horcht auf dessen Signal. So bleibt
 * die gewohnte Adresse bestehen, und es gibt trotzdem automatisches Nachladen.
 */
export function watch() {
  let laeuft = false;
  let erneutBauen = false;

  const MELDEPORT = Number(process.env.BS_PORT ?? 3001);
  const clientUrl = `http://{host}:${MELDEPORT}/browser-sync/browser-sync-client.js`;

  function bauen(danach) {
    if (laeuft) {
      // Während eines laufenden Baus gemeldete Änderungen nicht verlieren.
      erneutBauen = true;
      return;
    }

    laeuft = true;
    const start = Date.now();
    process.stdout.write("[watch] baue …");

    const bau = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "preview"], {
      stdio: ["ignore", "ignore", "inherit"],
      env: { ...process.env, NEXT_PUBLIC_BROWSERSYNC_URL: clientUrl },
    });

    bau.on("exit", (code) => {
      laeuft = false;
      const dauer = ((Date.now() - start) / 1000).toFixed(1);

      if (code === 0) {
        console.log(` fertig nach ${dauer}s – Seite wird neu geladen`);
        browserSync.reload();
      } else {
        console.log(` FEHLGESCHLAGEN (Code ${code}) – Seite bleibt wie sie ist`);
      }

      if (erneutBauen) {
        erneutBauen = false;
        bauen();
      } else if (danach) {
        danach();
      }
    });
  }

  return new Promise((fertig) => {
    bauen(() => {
      // Ohne server und ohne proxy startet BrowserSync im Meldebetrieb: Es
      // liefert nur seinen Client und den Websocket aus.
      browserSync.init(
        {
          port: MELDEPORT,
          ui: false,
          open: false,
          notify: false,
          cors: true,
          logSnippet: false,
        },
        () => {
          console.log(
            "\n[watch] Adresse: http://localhost:8888/MealMap/\n" +
              "[watch] Die Seite lädt sich nach jedem Bau von selbst neu.\n",
          );

          // dist/ und out/ bewusst nicht beobachten – sonst löst der Bau sich
          // selbst wieder aus.
          gulp.watch(
            ["src/**/*", "api/**/*", "public/**/*", "next.config.ts"],
            { ignoreInitial: true },
            (erledigt) => {
              bauen();
              erledigt();
            },
          );

          fertig();
        },
      );
    });
  });
}

export default sync;
