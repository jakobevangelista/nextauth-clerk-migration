import { auth } from "@/auth";
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import { eq } from "drizzle-orm";

// returns true if the old auth system has a session
export async function oldCheckHasSession() {
  return await auth();
}

// returns data about the user in a specific format
export async function oldGetUserData() {
  const session = await auth();
  const user = await db.query.users.findFirst({
    where: eq(users.email, session!.user!.email!),
  });

  return {
    emailAddress: [session!.user!.email!],
    passwordHash: user!.password!,
  };
}
