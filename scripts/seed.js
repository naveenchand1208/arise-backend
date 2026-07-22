import { closeSeedConnection, runSeed } from "../src/seeds/seed.js";

try {
  const result = await runSeed();
  console.log("[seed] complete:", JSON.stringify(result, null, 2));
} catch (error) {
  console.error("[seed] failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeSeedConnection();
}
