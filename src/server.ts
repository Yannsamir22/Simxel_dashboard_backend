import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import prisma from "./config/db.js";
import { startWeeklyReportJob } from "./jobs/weeklyReport.job.js";

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await prisma.$connect();
    console.log("[DB] Connected to Database.");

    app.listen(PORT, () => {
      console.log(`[SERVER] Simxel Cloud Dashboard running on http://localhost:${PORT}`);
      console.log(`[SERVER] Health: http://localhost:${PORT}/health`);
      startWeeklyReportJob();
    });
  } catch (error) {
    console.error("[SERVER] Startup failed:", error);
    process.exit(1);
  }
}

start();
