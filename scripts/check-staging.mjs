import { build } from "vite";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { publicBinding } from "../config/staging.js";
assert.throws(() => publicBinding("staging"), /gate closed/);
// Compile the gated implementation without adding an approved project or executing the bundle.
const outDir = await mkdtemp(join(tmpdir(), "folio-stage-build-"));
try {
  await build({
    configFile: false,
    logLevel: "error",
    resolve: { alias: { "@store": resolve("src/staging/store.js") } },
    build: { outDir, emptyOutDir: true },
  });
  assert(
    !(await readdir(join(outDir, "assets"))).some((n) => n.endsWith(".wasm")),
  );
  console.log(
    "Hosted provider compiled in isolation; approved binding list remains closed.",
  );
} finally {
  await rm(outDir, { recursive: true, force: true });
}
