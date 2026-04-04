import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import routes from "./routes/index.route.js";
import { errorHandler } from "./middlewares/error.middleware.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  // In production, set CORS_ORIGIN env var to your Vercel/Netlify frontend URL
  // e.g. CORS_ORIGIN="https://simxel-dashboard.vercel.app"
  origin: (origin, callback) => {
    const allowed = [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3001",
      process.env.CORS_ORIGIN,            // production dashboard URL
      process.env.CORS_ORIGIN_HOME,       // production home site URL
    ].filter(Boolean) as string[];

    // Allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use("/api", routes);

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "Simxel Cloud Dashboard", ts: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Route not found." });
});

app.use(errorHandler);

export default app;
