import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb.js";
import { Challenge } from "../models/Challenge.js";
import { Asana, BreathworkTechnique, MasterTeacher, Quote, WealthAffirmation } from "../models/Content.js";
import { SEED_SOURCE, seedCollections } from "./data/systemContent.js";
import { validateSeedData } from "./validateSeed.js";

const collectionModels = {
  masters: MasterTeacher,
  asanas: Asana,
  breathwork: BreathworkTechnique,
  affirmations: WealthAffirmation,
  quotes: Quote,
  challenges: Challenge,
};

const safeUpdateExisting = (existing) => existing.systemContent === true && existing.source === SEED_SOURCE;

async function seedCollection(collectionName, items, Model, options) {
  const summary = { created: 0, updated: 0, skipped: 0, failed: 0 };

  for (const item of items) {
    try {
      const existing = await Model.findOne({ slug: item.slug });
      if (!existing) {
        await Model.create(item);
        summary.created += 1;
        continue;
      }

      if (options.updateExisting && safeUpdateExisting(existing)) {
        await Model.updateOne({ _id: existing._id }, { $set: item });
        summary.updated += 1;
        continue;
      }

      summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`[seed] ${collectionName}:${item.slug} failed - ${error.message}`);
    }
  }

  return summary;
}

export async function runSeed(options = {}) {
  const updateExisting = options.updateExisting ?? process.env.SEED_UPDATE_EXISTING === "true";
  const validation = validateSeedData();
  if (!validation.valid) {
    const error = new Error(`Seed data validation failed:\n${validation.errors.join("\n")}`);
    error.validation = validation;
    throw error;
  }

  await connectDB();
  const report = {};

  for (const [collectionName, items] of Object.entries(seedCollections)) {
    report[collectionName] = await seedCollection(collectionName, items, collectionModels[collectionName], {
      updateExisting,
    });
  }

  return {
    source: SEED_SOURCE,
    updateExisting,
    report,
  };
}

export async function closeSeedConnection() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
