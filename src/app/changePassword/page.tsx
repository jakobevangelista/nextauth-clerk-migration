import { auth as nextAuthFunction } from "@/auth";
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import { auth } from "@clerk/nextjs/server";

import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

// checks if user is in clerk, if in clerk, change password in clerk (semantic user button)
// if not in clerk, change password in nextauth
export default async function Home() {
  const { userId }: { userId: string | null } = auth();
  const nexAuthUser = await nextAuthFunction();

  if (userId === null && nexAuthUser === null) {
    return redirect("/sign-in");
  }

  // if the user hasn't been migrated to clerk, change the password in nextauth
  if (userId === null) {
    return (
      <>
        <form
          action={async (formData) => {
            "use server";
            await db.update(users).set({
              password: formData.get("password") as string,
            });
          }}
        >
          <input type="password" name="password" />
          <button type="submit">Change Password</button>
        </form>
      </>
    );
  }

  // semantic representation of changing user profile in clerk
  return (
    <>
      <UserButton />
    </>
  );
}
