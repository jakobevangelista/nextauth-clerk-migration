"use server";
import { auth } from "@/auth";
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import { eq } from "drizzle-orm";
import { type CreateUserParams } from "./routeHelper";

// returns true if the old auth system has a session
export async function oldCheckHasSession() {
  const session = await auth();
  return session;
}

// returns data about the user using creatUserParams
export async function oldGetUserData() {
  const session = await auth();
  const user = await db.query.users.findFirst({
    where: eq(users.email, session!.user!.email!),
  });

  return {
    id: user?.id,
    emailAddress: [session!.user!.email!],
    password: user!.password,
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  } as CreateUserParams;
}
