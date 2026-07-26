/**
 * tests/run.mjs — spusti testy adaptérov (ADR-001).
 *
 *     npm test
 *
 * Testy sú v TypeScripte a importujú zo src/ bez prípon, takže sa pred
 * spustením zbundlujú esbuildom. Sieť ani databáza nie sú potrebné —
 * streamy aj profily sa testujú na syntetických dátach.
 */
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUITY = ["streams.test.ts", "profile.test.ts", "guard.test.ts"];
const tmp = mkdtempSync(join(tmpdir(), "contineo-tests-"));

let zlyhalo = 0;
try {
  for (const suita of SUITY) {
    const out = join(tmp, suita.replace(/\.ts$/, ".cjs"));
    await build({
      entryPoints: [join(HERE, suita)],
      bundle: true, outfile: out, format: "cjs", platform: "node",
      logLevel: "error",
    });
    console.log(`\n── ${suita} ${"─".repeat(Math.max(0, 46 - suita.length))}`);
    const r = spawnSync(process.execPath, [out], {
      stdio: "inherit",
      env: { ...process.env, MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://stub" },
    });
    if (r.status !== 0) zlyhalo++;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log("\n" + "=".repeat(56));
console.log(zlyhalo ? `ZLYHALO ${zlyhalo} z ${SUITY.length} súborov` : `Všetky suity prešli (${SUITY.length})`);
process.exit(zlyhalo ? 1 : 0);
