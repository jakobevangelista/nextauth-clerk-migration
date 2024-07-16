// import { auth } from "../_auth-migration/authPatch";

import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default function CustomClerkProtected() {
  const { userId }: { userId: string | null } = auth();
  if (!userId) {
    redirect("/custom-clerk-sign-in");
  }
  return (
    <>
      <div>CustomClerkProtected</div>
      <UserButton />
    </>
  );
}
