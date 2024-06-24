import { auth } from "@/auth";
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import {
  auth as clerkAuthFunction,
  clerkClient,
  type User,
} from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  const { userId }: { userId: string | null } = clerkAuthFunction();

  if (userId) return new Response("User already exists", { status: 222 });
  if (!session?.user?.email)
    return new Response("User not signed into next auth", { status: 222 });

  // checks for user email already existing (inserted from batch import)
  const searchUser = await clerkClient.users.getUserList({
    emailAddress: [session.user.email],
  });

  let createdUser: User | null | undefined = null;
  if (searchUser.data.length > 0) {
    createdUser = searchUser.data[0];
  } else {
    const user = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
    });

    if (!user) throw new Error("User not found");
    // creates user in clerk, with password if it exists, and externalId as the user id
    // to access tenet table attributes
    createdUser = await clerkClient.users.createUser({
      emailAddress: [session.user.email],
      password: user.password ?? undefined,
      skipPasswordChecks: true,
      externalId: `${user.id}`,
    });
  }

  if (!createdUser) throw new Error("User not created");

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
