// Corre el API en desarrollo y lo reinicia cuando cambia algo en src/.
//
// Hace lo mismo que `tsx watch`, con una diferencia: antes de reiniciar le pide al API (por IPC) que se
// cierre solo, así cierra la base. En Windows, `tsx watch` mata el proceso sin darle chance de limpiar,
// y la base local (PGlite) a veces queda dañada y no vuelve a abrir.
import { fork } from "node:child_process";
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const execArgv = ["--import", "tsx", "--env-file-if-exists=../../.env"];
const GRACE_MS = 5_000;

let child = null;
let restarting = false;
let quitting = false;

function start() {
  child = fork(entry, [], { cwd: root, execArgv, stdio: "inherit" });
  child.on("exit", (code) => {
    child = null;
    if (quitting) process.exit(0);
    if (!restarting && code !== 0) console.log("[dev] el API se cerró con un error. Guardá un cambio para volver a arrancarlo.");
  });
}

/** Le pide al API que se cierre solo y espera; si no termina a tiempo, lo mata. */
function stop() {
  return new Promise((resolve) => {
    if (!child) return resolve();
    const c = child;
    const timer = setTimeout(() => c.kill(), GRACE_MS);
    c.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    if (c.connected) c.send("shutdown");
    else c.kill();
  });
}

async function restart(file) {
  if (restarting) return;
  restarting = true;
  console.log(`[dev] cambió ${file}, reiniciando…`);
  await stop();
  restarting = false;
  start();
}

// Varios cambios seguidos (guardar, cambiar de rama) cuentan como uno
let debounce;
watch(fileURLToPath(new URL("../src", import.meta.url)), { recursive: true }, (_event, file) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => restart(file ?? "src"), 200);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (quitting) return;
    quitting = true;
    await stop();
    process.exit(0);
  });
}

start();
