import mongoose from "mongoose";

let isConnected = false;
mongoose.set("bufferCommands", false);

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

  const timeoutMs = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 3000);
  await Promise.race([
    mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 3000),
      connectTimeoutMS: timeoutMs,
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 5000),
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("MongoDB connection timed out")), timeoutMs + 1000)
    ),
  ]);
  isConnected = true;
  console.log("MongoDB connected");
  return mongoose.connection;
}
