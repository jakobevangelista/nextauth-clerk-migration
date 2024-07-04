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
    externalId: user?.id,
    emailAddress: [session!.user!.email!],
    password: user!.password,
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  } as CreateUserParams;
}

// used for the first part of done for you batch
export async function getAllUsers() {
  const users = await db.query.users.findMany({
    columns: {
      id: true,
    },
  });

  return users;
}

// used on the second part of done for you batch
export async function oldGetUserById(id: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  return {
    externalId: user?.id,
    emailAddress: [user!.email],
    password: user!.password,
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  } as CreateUserParams;
}
