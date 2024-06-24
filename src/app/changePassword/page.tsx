import { auth } from "@clerk/nextjs/server";

import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default function Home() {
  const { userId }: { userId: string | null } = auth();

  if (userId === null) {
    return redirect("/sign-in");
  }

  // semantic representation of changing user profile in clerk
  return (
    <>
      <UserButton />
    </>
  );
}
