import { seedCollections } from "./data/systemContent.js";

const forbiddenPatterns = [
  /\blorem\b/i,
  /\bplaceholder\b/i,
  /\btodo\b/i,
  /\btest user\b/i,
  /\bjohn doe\b/i,
  /\bas an ai\b/i,
  /https?:\/\//i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
];

const addRequiredErrors = (errors, collectionName, item, fields) => {
  for (const field of fields) {
    if (item[field] === undefined || item[field] === null || item[field] === "") {
      errors.push(`${collectionName}:${item.slug || "missing-slug"} missing ${field}`);
    }
  }
};

const assertUnique = (errors, collectionName, values, label) => {
  const seen = new Set();
  for (const value of values.filter(Boolean)) {
    const key = String(value).trim().toLowerCase();
    if (seen.has(key)) errors.push(`${collectionName} duplicate ${label}: ${value}`);
    seen.add(key);
  }
};

export function validateSeedData(collections = seedCollections) {
  const errors = [];
  const counts = {};
  const allSlugs = [];

  for (const [collectionName, items] of Object.entries(collections)) {
    if (!Array.isArray(items) || items.length === 0) {
      errors.push(`${collectionName} must contain seed records`);
      continue;
    }

    counts[collectionName] = items.length;
    assertUnique(errors, collectionName, items.map((item) => item.slug), "slug");
    allSlugs.push(...items.map((item) => item.slug));

    for (const item of items) {
      addRequiredErrors(errors, collectionName, item, ["slug", "status", "isActive", "source", "seedVersion"]);
      if (item.systemContent !== true) errors.push(`${collectionName}:${item.slug} must be marked systemContent`);

      const serialized = JSON.stringify(item);
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(serialized)) errors.push(`${collectionName}:${item.slug} contains forbidden seed text ${pattern}`);
      }

      if (collectionName === "masters") addRequiredErrors(errors, collectionName, item, ["name", "tagline", "tradition"]);
      if (collectionName === "asanas") addRequiredErrors(errors, collectionName, item, ["name", "subtitle", "cueText"]);
      if (collectionName === "breathwork") addRequiredErrors(errors, collectionName, item, ["name", "subtitle", "guidanceText"]);
      if (collectionName === "affirmations") addRequiredErrors(errors, collectionName, item, ["text", "category"]);
      if (collectionName === "quotes") addRequiredErrors(errors, collectionName, item, ["text", "author", "category"]);

      if (collectionName === "challenges") {
        addRequiredErrors(errors, collectionName, item, ["title", "teacher", "lengthDays", "description", "category", "layer"]);
        if (![21, 66, 90].includes(item.lengthDays)) errors.push(`${collectionName}:${item.slug} invalid lengthDays`);
        if (!Array.isArray(item.dailyTasks) || item.dailyTasks.length !== item.lengthDays) {
          errors.push(`${collectionName}:${item.slug} dailyTasks must match lengthDays`);
        } else {
          item.dailyTasks.forEach((task, index) => {
            if (task.day !== index + 1) errors.push(`${collectionName}:${item.slug} task ${index + 1} has wrong day`);
            if (!task.prompt) errors.push(`${collectionName}:${item.slug} task ${index + 1} missing prompt`);
          });
        }
      }
    }
  }

  assertUnique(errors, "all seed collections", allSlugs, "slug");
  assertUnique(errors, "affirmations", collections.affirmations?.map((item) => item.text) || [], "text");
  assertUnique(errors, "quotes", collections.quotes?.map((item) => item.text) || [], "text");

  return { valid: errors.length === 0, errors, counts };
}

export function printValidationReport(result) {
  console.log("[seed:validate] collection counts:", result.counts);
  if (result.valid) {
    console.log("[seed:validate] OK");
    return;
  }

  console.error("[seed:validate] FAILED");
  for (const error of result.errors) console.error(`- ${error}`);
}
