import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import { auth, clerkClient, type User } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { oldCheckHasSession, oldGetUserData } from "./helpers";

export async function POST() {
  const session = await oldCheckHasSession();
  const { userId }: { userId: string | null } = auth();

  if (userId) return new Response("User already exists", { status: 222 });
  if (!session?.user?.email)
    return new Response("User not signed into next auth", { status: 222 });

  let createdUser: User | null | undefined = null;

  try {
    const user = await oldGetUserData();

    if (!user) throw new Error("User not found");
    createdUser = await clerkClient.users.createUser({
      emailAddress: [session.user.email],
      password: user.passwordHash ?? undefined,
      skipPasswordChecks: true,
      externalId: `${user.id}`,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (e.errors[0].message as string).includes("That email address is taken")
    ) {
      // checks for user email already existing (inserted from batch import)
      const searchUser = await clerkClient.users.getUserList({
        emailAddress: [session.user.email],
      });
      createdUser = searchUser.data[0];
    }
  }

  if (!createdUser) throw new Error("User not created");
  console.log("USER: ", createdUser.primaryEmailAddress?.emailAddress);

  // creates sign in token for user
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const signInToken: { token: string } = await fetch(
    "https://api.clerk.com/v1/sign_in_tokens",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
      body: JSON.stringify({
        user_id: createdUser.id,
      }),
    }
  ).then(async (res) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await res.json();
  });

  if (!signInToken.token) throw new Error("Sign in token not created");

  return new Response(JSON.stringify({ token: signInToken.token }), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
