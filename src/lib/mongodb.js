import mongoose from "mongoose";

let isConnected = false;

/**
 * Simple singleton connection appropriate for Express's single long-running
 * process (unlike Next.js serverless, there's no hot-reload/cold-start
 * concern here, so no global-caching workaround is needed).
 *
 * The env var is read inside the function, not at module load time, so this
 * module is safe to import before dotenv has loaded — the check only fires
 * when connectDB() is actually called (after server.js has run dotenv config).
 */
export async function connectDB() {
  if (isConnected) return mongoose.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Please define MONGODB_URI in your .env file");

  await mongoose.connect(uri);
  isConnected = true;
  console.log("MongoDB connected");
  return mongoose.connection;
}
