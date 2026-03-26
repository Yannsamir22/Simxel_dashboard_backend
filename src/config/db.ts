import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

// Single Prisma client — Cloud Dashboard connects ONLY to Supabase PostgreSQL
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.CLOUD_DATABASE_URL } },
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export default prisma;
