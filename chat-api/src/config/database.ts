import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";

config({ path: ".env" });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not defined");

export const db = drizzle(neon(process.env.DATABASE_URL));
