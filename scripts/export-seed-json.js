import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SEED_SOURCE, SEED_VERSION, seedCollections } from "../src/seeds/data/systemContent.js";

const outDir = path.resolve("database", "arise-production-seed");
await mkdir(outDir, { recursive: true });

const manifest = {
  name: "ARISE production seed package",
  source: SEED_SOURCE,
  version: SEED_VERSION,
  generatedAt: new Date().toISOString(),
  safety: {
    idempotentKey: "slug",
    includesUserData: false,
    includesTransactionalData: false,
    updateExistingByDefault: false,
  },
  collections: Object.fromEntries(
    Object.entries(seedCollections).map(([collectionName, items]) => [
      collectionName,
      { file: `${collectionName}.json`, count: items.length },
    ])
  ),
};

await writeFile(path.join(outDir, "seed-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
for (const [collectionName, items] of Object.entries(seedCollections)) {
  await writeFile(path.join(outDir, `${collectionName}.json`), `${JSON.stringify(items, null, 2)}\n`);
}

console.log(`[seed:export] wrote JSON package to ${outDir}`);
