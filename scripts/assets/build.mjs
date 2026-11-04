import { outputs, sourceIds } from "./config.mjs";
import { readImage } from "./io.mjs";

// The batch orchestration is completed by item 10.3. Validate all masters first.
for (const source of sourceIds) {
  await readImage(new URL(`../../art/source/lote-01/${source}.png`, import.meta.url));
}
console.log(`Validated ${sourceIds.length} masters for ${outputs.length} outputs.`);
