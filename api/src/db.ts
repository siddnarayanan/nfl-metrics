import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Capped on purpose: in a serverless deployment each concurrent function
  // instance gets its own pool, so the default (10) could open far more
  // connections against Supabase's pooler than a single always-on server
  // ever would under the same load.
  max: 5,
});
