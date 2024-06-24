import { and, eq } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import google from "next-auth/providers/google";
import { db } from "./server/neonDb/index";
import { users } from "./server/neonDb/schema";
import { getUserByEmail } from "./server/queries";
import { clerkClient } from "@clerk/nextjs/server";

export default {
  providers: [
    Credentials({
      async authorize(credentials) {
        // for (let i = 0; i < 30; i++) {
        //   try {
        //     const createdUser = await clerkClient.users.createUser({
        //       emailAddress: [`${Math.random()}@gmail.com`],
        //       skipPasswordRequirement: true,
        //       skipPasswordChecks: true,
        //     });
        //     console.log(createdUser.emailAddresses[0]?.emailAddress);
        //   } catch (e) {
        //     console.log(e);
        //   }
        // }
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
