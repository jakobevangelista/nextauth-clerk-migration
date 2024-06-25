import { auth } from "@/auth";
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import {
  auth as clerkAuthFunction,
  clerkClient,
  User,
} from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import ClientClerkcomponent from "./clientWrapper";
import { Session } from "next-auth";
import pRetry from "p-retry";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createdNewUser = async (session: Session, createdUser: any) => {
  const user = await db.query.users.findFirst({
    where: eq(users.email, session.user!.email!),
  });

  if (!user) return <div>Failed to find user create user in db</div>;
  // creates user in clerk, with password if it exists, and externalId as the user id
  // to access tenet table attributes
  createdUser = await clerkClient.users.createUser({
    emailAddress: [session.user!.email!],
    password: user.password ?? undefined,
    skipPasswordChecks: true,
    externalId: `${user.id}`,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return createdUser;
};

export default async function MigrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const { userId }: { userId: string | null } = clerkAuthFunction();
  // console.log("MADE IT HERE AT LEASTTTTTTTTT", userId);

  if (userId) return <>{children}</>;

  if (!session?.user) return <>{children}</>;

  // checks for user email already existing (inserted from batch import)
  const searchUser = await clerkClient.users.getUserList({
    emailAddress: [session.user.email!],
  });

  let createdUser: User | null | undefined = null;

  if (searchUser.data.length > 0) {
    createdUser = searchUser.data[0];
  } else {
    if (!session.user.email) return <div>Failed to create user in clerk</div>;
    for (let i = 0; i < 30; i++) {
      try {
        await clerkClient.users.createUser({
          emailAddress: [`${Math.random()}@gmail.com`],
          skipPasswordRequirement: true,
          skipPasswordChecks: true,
        });
      } catch (e) {
        console.log(e);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    createdUser = await pRetry(() => createdNewUser(session, createdUser), {
      onFailedAttempt: (error) => {
        console.log(
          `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`
        );
      },
    });
  }

  if (!createdUser) return <div>Failed to create user</div>;

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

  if (!signInToken.token) return <div>Failed to create sign in token</div>;

  return (
    <>
      <ClientClerkcomponent sessionId={signInToken.token} />
      {children}
    </>
  );
}
