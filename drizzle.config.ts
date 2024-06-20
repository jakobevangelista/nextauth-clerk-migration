import { type Config } from "drizzle-kit";

export default {
  schema: "./src/server/neonDb/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
