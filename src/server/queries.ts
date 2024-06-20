"use server";

import { and, eq } from "drizzle-orm";

import credentials from "next-auth/providers/credentials";
import { db } from "./neonDb";
import { users } from "./neonDb/schema";

export const getUserByEmail = async (email: string) => {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  return user;
};
