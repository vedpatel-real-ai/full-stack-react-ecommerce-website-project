import { pathToFileURL } from "node:url";
import { reconcile } from "../server/gateway.js";
import { stagingConfig, stagingStore } from "../server/staging.js";
export async function runReconciliation(env, inquiry) {
  if (!inquiry) return reconcile(null, null);
  const config = stagingConfig(env);
  return reconcile(stagingStore(config), inquiry);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  // Wire a merchant-approved status transport in the independent sandbox release.
  const result = await runReconciliation(process.env, null);
  console.log(JSON.stringify(result));
}
