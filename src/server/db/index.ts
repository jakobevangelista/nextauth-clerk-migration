import { drizzle } from "drizzle-orm/mysql2";
import {
  createPool,
  createConnection,
  type Connection,
  type Pool,
} from "mysql2/promise";
// import mysql from "mysql2/promise";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

// const globalForDb = globalThis as unknown as {
//   conn: Connection | undefined;
// };

const conn =
  globalForDb.conn ??
  // createConnection({
  //   uri: process.env.DATABASE_URL,
  //   // uri: "mysql://root:hdbFGYCJvcZmAFOioLGBjJZsMaLMxiKQ@viaduct.proxy.rlwy.net:29202/railway",
  // });
  createPool({
    uri: process.env.DATABASE_URL,
    // uri: "mysql://root:hdbFGYCJvcZmAFOioLGBjJZsMaLMxiKQ@viaduct.proxy.rlwy.net:29202/railway",
  });

if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;
export const db = drizzle(conn, { schema, mode: "default" });

// const connection = await mysql.createConnection({
//   uri: process.env.DATABASE_URL,
// });
// export const db = drizzle(connection, { schema, mode: "default" });
