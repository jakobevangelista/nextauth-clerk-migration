import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import { db } from "./server/neonDb/index";

import authConfig from "@/auth.config";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "./server/neonDb/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    accountsTable: accounts,
    usersTable: users,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },

  ...authConfig,
});
