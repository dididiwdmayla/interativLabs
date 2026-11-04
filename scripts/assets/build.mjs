import { fileURLToPath } from "node:url";
import { processBatch } from "./process.mjs";
import { publish } from "./publish.mjs";
import { contacts } from "./contacts.mjs";
import { report } from "./report.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const prepared = await processBatch(root);
const metrics = await publish(prepared, root);
const sheets = await contacts(prepared, root);
await report(metrics, sheets, root);
console.log(`Processed ${prepared.length} outputs.`);
