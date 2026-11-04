import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { format } from "prettier";
import { settings } from "./config.mjs";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

async function filesBelow(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...(await filesBelow(join(directory, entry.name), name + "/")));
    else result.push(name);
  }
  return result.sort();
}

export async function generatedHashes(root) {
  const contactRoot = `docs/capturas/${settings.batch}`;
  const paths = [
    ...(await filesBelow(join(root, "public/assets"))).map((file) => `public/assets/${file}`),
    "src/assets/registry.ts",
    ...(await filesBelow(join(root, contactRoot)))
      .filter((file) => file.endsWith(".webp") || ["medidas.json", "medidas.md"].includes(file))
      .map((file) => `${contactRoot}/${file}`),
  ].sort();
  const hashes = {};
  for (const path of paths)
    hashes[path] = createHash("sha256")
      .update(await readFile(join(root, path)))
      .digest("hex");
  return { files: hashes, aggregate: createHash("sha256").update(JSON.stringify(hashes)).digest("hex") };
}

export async function runBuild(destination) {
  const args = destination ? ["run", "assets", "--", "--out-dir", destination] : ["run", "assets"];
  await new Promise((done, reject) => {
    const child = spawn("npm", args, { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? done() : reject(new Error(`Asset build failed (${code}):\n${output}`)),
    );
  });
}

export async function verify(destination = null) {
  const root = destination ?? projectRoot;
  await runBuild(destination);
  const first = await generatedHashes(root);
  await runBuild(destination);
  const second = await generatedHashes(root);
  if (JSON.stringify(first.files) !== JSON.stringify(second.files))
    throw new Error("Asset pipeline is not byte deterministic");
  return {
    command: "npm run assets (duas execuções)",
    filesChecked: Object.keys(first.files).length,
    first: first.aggregate,
    second: second.aggregate,
    identical: true,
    files: first.files,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const evidence = await verify();
  await writeFile(
    join(projectRoot, "docs/capturas", settings.batch, "determinismo.json"),
    await format(JSON.stringify(evidence), { parser: "json", printWidth: 110 }),
  );
  console.log(`Determinism verified: ${evidence.filesChecked} files, SHA-256 ${evidence.first}`);
}
