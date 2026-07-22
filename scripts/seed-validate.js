import { printValidationReport, validateSeedData } from "../src/seeds/validateSeed.js";

const result = validateSeedData();
printValidationReport(result);
if (!result.valid) process.exitCode = 1;
