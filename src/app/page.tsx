import { auth, signOut } from "@/auth";
import { db } from "@/server/neonDb";
import { userAttributes, users } from "@/server/neonDb/schema";
import { eq } from "drizzle-orm";

import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session === null) {
    return redirect("/sign-in");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, session.user?.email!),
  });

  const userAttribute = await db.query.userAttributes.findFirst({
    where: eq(userAttributes.userId, user?.id!),
  });

  return (
    <>
      <div>Signed In with Next-Auth</div>
      <div>{JSON.stringify(session)}</div>
      <div>Special Attribute: {userAttribute?.attribute}</div>
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button type="submit">Sign Out</button>
      </form>
    </>
  );
}
