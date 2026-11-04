import { fileURLToPath } from "node:url";
import { processBatch } from "./process.mjs";
import { publish } from "./publish.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const prepared = await processBatch(root);
await publish(prepared, root);
console.log(`Processed ${prepared.length} outputs.`);
