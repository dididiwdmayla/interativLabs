import { fileURLToPath } from "node:url";
import { processBatch } from "./process.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const prepared = await processBatch(root);
console.log(`Processed ${prepared.length} outputs.`);
