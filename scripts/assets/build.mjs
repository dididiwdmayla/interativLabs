import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolve, join } from "node:path";
import { readdir, access, readFile } from "node:fs/promises";
import { processBatch } from "./process.mjs";
import { publish } from "./publish.mjs";
import { contacts } from "./contacts.mjs";
import { report } from "./report.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { values } = parseArgs({ options: { "out-dir": { type: "string" } } });
const destination = values["out-dir"] ? resolve(values["out-dir"]) : root;
// Refuse to silently omit a newly added batch or an unconfigured master.
const { settings, sourceIds } = await import("./config.mjs");
for (const entry of await readdir(join(root, "art/source"), { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith("lote-")) continue;
  await access(join(root, "art/source", entry.name, "asset-manifest.md"));
  if (entry.name !== settings.batch)
    throw new Error(`Configure the new batch before building: ${entry.name}`);
}
const files = (await readdir(join(root, "art/source", settings.batch)))
  .filter((name) => name.endsWith(".png"))
  .map((name) => name.slice(0, -4))
  .sort();
if (JSON.stringify(files) !== JSON.stringify(sourceIds))
  throw new Error("PNG inventory differs from config.mjs");
const manifest = await readFile(join(root, "art/source", settings.batch, "asset-manifest.md"), "utf8");
const ids = [
  ...manifest.matchAll(/^\| `([^`]+)` \| (?:palco|ferragens|molas|materiais|efeitos|entrada) \|/gm),
]
  .map((match) => match[1])
  .sort();
if (JSON.stringify(ids) !== JSON.stringify(sourceIds)) throw new Error("Manifest IDs differ from config.mjs");
const prepared = await processBatch(root);
const metrics = await publish(prepared, destination);
const sheets = await contacts(prepared, destination);
await report(metrics, sheets, destination);
console.log(`Processed ${prepared.length} outputs.`);
