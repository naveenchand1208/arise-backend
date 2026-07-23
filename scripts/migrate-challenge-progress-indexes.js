import "dotenv/config";
import { connectDB } from "../src/lib/mongodb.js";
import { ChallengeProgress } from "../src/models/Challenge.js";

await connectDB();

const collection = ChallengeProgress.collection;
const indexes = await collection.indexes();
for (const index of indexes) {
  const isLegacyUniquePair =
    index.unique === true &&
    index.partialFilterExpression == null &&
    Object.keys(index.key || {}).length === 2 &&
    index.key.userId === 1 &&
    index.key.challengeId === 1;
  if (isLegacyUniquePair) {
    await collection.dropIndex(index.name);
    console.log(`Dropped legacy index: ${index.name}`);
  }
}

await ChallengeProgress.syncIndexes();
console.log("Challenge progress indexes are current.");
process.exit(0);
