import { auth, signOut } from "@/auth";
import { auth as authPatch } from "./authPatch";

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/server/neonDb";
import { eq } from "drizzle-orm";
import { userAttributes } from "@/server/neonDb/schema";

export default async function Home() {
  const session = await auth();
  const clerkUser = authPatch();
  const gettingMetadata = await currentUser();

  if (session === null) {
    return redirect("/sign-in");
  }

  const userAttribute = await db.query.userAttributes.findFirst({
    where: eq(userAttributes.id, clerkUser!.userId),
  });

  return (
    <>
      <div>Signed In with Next-Auth</div>
      <div>{JSON.stringify(session)}</div>
      <div>
        Role Metadata: {gettingMetadata!.publicMetadata.role! as string}
      </div>
      {/* <div>Special Attribute: {userAttribute?.attribute}</div> */}
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
