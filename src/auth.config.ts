import { and, eq } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import google from "next-auth/providers/google";
import { db } from "./server/neonDb/index";
import { users } from "./server/neonDb/schema";
import { getUserByEmail } from "./server/queries";

export default {
  providers: [
    Credentials({
      async authorize(credentials) {
        const user = await getUserByEmail(credentials.email as string);

        if (!user?.password) {
          return null;
        }

        const checkIfPasswordMatch = user.password === credentials.password;

        if (!checkIfPasswordMatch) {
          return null;
        }
        return user;
      },
    }),
  ],
} satisfies NextAuthConfig;
