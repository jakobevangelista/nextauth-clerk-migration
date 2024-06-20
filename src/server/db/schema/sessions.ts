import { mysqlTableCreator, timestamp, varchar } from "drizzle-orm/mysql-core";
import { users } from "./users";

export const mysqlTable = mysqlTableCreator((name) => `testapp_${name}`);
export const sessions = mysqlTable("session", {
  sessionToken: varchar("sessionToken", { length: 255 }).primaryKey(),
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});
